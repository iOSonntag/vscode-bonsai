import {
  CancellationTokenSource,
  EventEmitter,
  workspace,
  type Disposable,
  type Event,
  type LogOutputChannel,
  type Uri,
  type WorkspaceFolder,
} from 'vscode';
import { type BonsaiConfigurationService, type ResolvedConfiguration } from '../configuration/bonsaiConfigurationService.js';
import { allFilterId, type ResolvedFilter } from '../rules/catalog/filterCatalog.js';
import { resolveFilter } from '../rules/catalog/resolveFilter.js';
import { splitRelativePath } from '../rules/paths/relativePath.js';
import { computeExclusionPlan, WalkCancelledError } from '../rules/plan/exclusionPlan.js';
import { createFolderNameMatcher, createRelativePathMatcher, type FolderNameMatcher } from '../rules/plan/pathMatchers.js';
import { createDirectoryReaderForFolder } from './directoryReaders.js';
import { type ExcludeSettingWriter } from './excludeSettingWriter.js';
import { type FilterStateStore } from './filterStateStore.js';

export interface FilterSummary
{
  readonly id: string;
  readonly label: string;
  readonly isActive: boolean;
}

export interface FilterSessionState
{
  readonly activeFilterId: string;
  readonly activeFilterLabel: string;
  readonly isBusy: boolean;
  readonly isPartial: boolean;
  readonly problems: readonly string[];
}

export interface ExcludeSettingWrittenEvent
{
  readonly folder: WorkspaceFolder;
}

const watcherDebounceMs = 300;
const settingsFileRelativePath = '.vscode/settings.json';
const ignoreCase = process.platform !== 'linux';

/**
 * Applies the active filter to every workspace folder and keeps it applied:
 * it recomputes on filter, configuration, folder, and file changes, and it repairs the
 * generated keys when something else removes them.
 */
export class FilterSession implements Disposable
{
  public readonly onDidChangeState: Event<FilterSessionState>;
  public readonly onDidWriteExcludeSetting: Event<ExcludeSettingWrittenEvent>;

  private readonly stateEmitter = new EventEmitter<FilterSessionState>();
  private readonly writeEmitter = new EventEmitter<ExcludeSettingWrittenEvent>();
  private readonly disposables: Disposable[] = [];
  private readonly cancellationByFolder = new Map<string, CancellationTokenSource>();
  private readonly debounceByFolder = new Map<string, NodeJS.Timeout>();
  private readonly writeQueueByFolder = new Map<string, Promise<void>>();
  private readonly expectedKeysByFolder = new Map<string, readonly string[]>();
  private readonly baselineSignatureByFolder = new Map<string, string>();
  private readonly leafFolderMatcherByFolder = new Map<string, FolderNameMatcher>();
  private readonly problemsByFolder = new Map<string, readonly string[]>();
  private readonly partialFolders = new Set<string>();
  private inFlightCount = 0;

  public constructor(
    private readonly configurationService: BonsaiConfigurationService,
    private readonly stateStore: FilterStateStore,
    private readonly writer: ExcludeSettingWriter,
    private readonly log: LogOutputChannel,
  )
  {
    this.onDidChangeState = this.stateEmitter.event;
    this.onDidWriteExcludeSetting = this.writeEmitter.event;
  }

  /** Reconciles stale keys, applies the saved filter, and starts to watch for changes. */
  public async start(): Promise<void>
  {
    this.disposables.push(
      this.configurationService.onDidChange(() =>
      {
        void this.recomputeAllFolders(false);
      }),
      workspace.onDidChangeConfiguration((event) =>
      {
        if (event.affectsConfiguration('files.exclude'))
        {
          this.handleExcludeSettingChange();
        }
      }),
      workspace.onDidChangeWorkspaceFolders((event) =>
      {
        for (const folder of event.removed)
        {
          this.forgetFolder(folder);
        }
        for (const folder of event.added)
        {
          void this.recomputeFolder(folder, true);
        }
        this.emitState();
      }),
      this.createFileWatcher(),
    );
    await this.recomputeAllFolders(true);
  }

  public getState(): FilterSessionState
  {
    const activeFilterId = this.stateStore.getActiveFilterId();
    const activeFilter = this.listFilters().find((filter) => filter.id === activeFilterId);
    return {
      activeFilterId,
      activeFilterLabel: activeFilter?.label ?? activeFilterId,
      isBusy: this.inFlightCount > 0,
      isPartial: this.partialFolders.size > 0,
      problems: [...new Set([...this.problemsByFolder.values()].flat())],
    };
  }

  /** The implicit All filter first, then every enabled filter of the effective configuration. */
  public listFilters(): FilterSummary[]
  {
    const activeFilterId = this.stateStore.getActiveFilterId();
    const configuration = this.configurationService.resolveForFolder(workspace.workspaceFolders?.[0]);
    const filters: FilterSummary[] = [{ id: allFilterId, label: 'All', isActive: activeFilterId === allFilterId }];
    for (const definition of configuration.catalog.filters.values())
    {
      if (definition.enabled)
      {
        filters.push({ id: definition.id, label: definition.label, isActive: definition.id === activeFilterId });
      }
    }
    return filters;
  }

  public async applyFilter(filterId: string): Promise<void>
  {
    await this.stateStore.setActiveFilterId(filterId);
    this.log.info(`Filter "${filterId}" selected.`);
    await this.recomputeAllFolders(true);
  }

  public async cycleFilter(): Promise<void>
  {
    const filters = this.listFilters();
    const activeIndex = filters.findIndex((filter) => filter.isActive);
    const nextFilter = filters[(activeIndex + 1) % filters.length];
    if (nextFilter !== undefined)
    {
      await this.applyFilter(nextFilter.id);
    }
  }

  public async refresh(): Promise<void>
  {
    await this.recomputeAllFolders(false);
  }

  public dispose(): void
  {
    for (const cancellation of this.cancellationByFolder.values())
    {
      cancellation.cancel();
      cancellation.dispose();
    }
    for (const timeout of this.debounceByFolder.values())
    {
      clearTimeout(timeout);
    }
    for (const disposable of this.disposables)
    {
      disposable.dispose();
    }
    this.stateEmitter.dispose();
    this.writeEmitter.dispose();
  }

  private async recomputeAllFolders(useCache: boolean): Promise<void>
  {
    await Promise.all((workspace.workspaceFolders ?? []).map((folder) => this.recomputeFolder(folder, useCache)));
  }

  private async recomputeFolder(folder: WorkspaceFolder, useCache: boolean): Promise<void>
  {
    const folderKey = folder.uri.toString();
    this.cancellationByFolder.get(folderKey)?.cancel();
    const cancellation = new CancellationTokenSource();
    this.cancellationByFolder.set(folderKey, cancellation);
    this.inFlightCount += 1;
    this.emitState();
    try
    {
      await this.recomputeFolderWithCancellation(folder, useCache, cancellation);
    }
    catch (error)
    {
      if (!(error instanceof WalkCancelledError))
      {
        this.log.error(`Filter computation failed for ${folder.name}: ${describeError(error)}`);
        this.problemsByFolder.set(folderKey, [`Filter computation failed for ${folder.name}: ${describeError(error)}`]);
      }
    }
    finally
    {
      this.inFlightCount -= 1;
      if (this.cancellationByFolder.get(folderKey) === cancellation)
      {
        this.cancellationByFolder.delete(folderKey);
      }
      cancellation.dispose();
      this.emitState();
    }
  }

  private async recomputeFolderWithCancellation(
    folder: WorkspaceFolder,
    useCache: boolean,
    cancellation: CancellationTokenSource,
  ): Promise<void>
  {
    const folderKey = folder.uri.toString();
    const configuration = this.configurationService.resolveForFolder(folder);
    const problems = configuration.problems.map((problem) => `[${problem.scope}] ${problem.path}: ${problem.message}`);
    this.leafFolderMatcherByFolder.set(folderKey, createFolderNameMatcher(configuration.leafFolders, ignoreCase));
    const filterId = this.stateStore.getActiveFilterId();
    if (filterId === allFilterId)
    {
      this.partialFolders.delete(folderKey);
      this.problemsByFolder.set(folderKey, problems);
      await this.writeGeneratedKeys(folder, [], cancellation);
      return;
    }
    const resolution = resolveFilter(configuration.catalog, filterId);
    problems.push(...resolution.problems.map((problem) => problem.message));
    this.problemsByFolder.set(folderKey, problems);
    if (resolution.kind === 'failed')
    {
      this.partialFolders.delete(folderKey);
      await this.writeGeneratedKeys(folder, [], cancellation);
      return;
    }
    const signature = buildPlanSignature(resolution.filter, configuration);
    if (useCache)
    {
      const cachedPlan = this.stateStore.getCachedPlan(folder, filterId, signature);
      if (cachedPlan !== undefined)
      {
        await this.writeGeneratedKeys(folder, [...cachedPlan.globEntries, ...cachedPlan.concreteEntries], cancellation);
      }
    }
    const baselineKeys = this.writer.readBaselineKeys(folder, this.stateStore.getManagedKeys(folder));
    this.baselineSignatureByFolder.set(folderKey, buildBaselineSignature(baselineKeys));
    const startedAt = Date.now();
    const plan = await computeExclusionPlan({
      filter: resolution.filter,
      reader: createDirectoryReaderForFolder(folder),
      isLeafFolderName: createFolderNameMatcher(configuration.leafFolders, ignoreCase),
      isHiddenByBaseline: createRelativePathMatcher(baselineKeys, ignoreCase),
      maxEntries: configuration.maxWalkEntries,
      ignoreCase,
      cancellation: cancellation.token,
    });
    if (cancellation.token.isCancellationRequested)
    {
      return;
    }
    if (plan.isPartial)
    {
      this.partialFolders.add(folderKey);
    }
    else
    {
      this.partialFolders.delete(folderKey);
    }
    this.log.info(
      `Plan for ${folder.name} with filter "${filterId}": ${plan.globEntries.length} glob entries, `
      + `${plan.concreteEntries.length} concrete entries, ${plan.entriesRead} entries read in ${Date.now() - startedAt} ms`
      + `${plan.isPartial ? ', budget reached' : ''}.`,
    );
    await this.stateStore.setCachedPlan(folder, filterId, {
      signature,
      globEntries: plan.globEntries,
      concreteEntries: plan.concreteEntries,
    });
    await this.writeGeneratedKeys(folder, [...plan.globEntries, ...plan.concreteEntries], cancellation);
  }

  /** Writes are serialized per folder, so the record and the setting never drift apart. */
  private writeGeneratedKeys(
    folder: WorkspaceFolder,
    keys: readonly string[],
    cancellation: CancellationTokenSource,
  ): Promise<void>
  {
    const folderKey = folder.uri.toString();
    const previousWrite = this.writeQueueByFolder.get(folderKey) ?? Promise.resolve();
    const nextWrite = previousWrite.then(async () =>
    {
      if (cancellation.token.isCancellationRequested)
      {
        return;
      }
      const previousRecord = this.stateStore.getManagedKeysRecord(folder);
      this.expectedKeysByFolder.set(folderKey, keys);
      const update = await this.writer.replaceManagedKeys(folder, previousRecord, keys);
      await this.stateStore.setManagedKeysRecord(folder, update.record);
      this.expectedKeysByFolder.set(folderKey, update.record.keys);
      if (update.didWrite)
      {
        this.writeEmitter.fire({ folder });
      }
    });
    this.writeQueueByFolder.set(folderKey, nextWrite.catch(() => undefined));
    return nextWrite;
  }

  private handleExcludeSettingChange(): void
  {
    for (const folder of workspace.workspaceFolders ?? [])
    {
      const folderKey = folder.uri.toString();
      const expectedKeys = this.expectedKeysByFolder.get(folderKey) ?? this.stateStore.getManagedKeys(folder);
      if (expectedKeys.length > 0 && !this.writer.areManagedKeysPresent(folder, expectedKeys))
      {
        this.log.info(`Generated keys of ${folder.name} were changed outside Bonsai. Applying the filter again.`);
        this.scheduleRecompute(folder);
        continue;
      }
      const baselineSignature = buildBaselineSignature(this.writer.readBaselineKeys(folder, expectedKeys));
      const previousSignature = this.baselineSignatureByFolder.get(folderKey);
      if (previousSignature !== undefined && previousSignature !== baselineSignature)
      {
        this.log.info(`The exclude setting of ${folder.name} changed. Applying the filter again.`);
        this.scheduleRecompute(folder);
      }
    }
  }

  private forgetFolder(folder: WorkspaceFolder): void
  {
    const folderKey = folder.uri.toString();
    this.cancellationByFolder.get(folderKey)?.cancel();
    const pendingTimeout = this.debounceByFolder.get(folderKey);
    if (pendingTimeout !== undefined)
    {
      clearTimeout(pendingTimeout);
      this.debounceByFolder.delete(folderKey);
    }
    this.expectedKeysByFolder.delete(folderKey);
    this.baselineSignatureByFolder.delete(folderKey);
    this.leafFolderMatcherByFolder.delete(folderKey);
    this.problemsByFolder.delete(folderKey);
    this.partialFolders.delete(folderKey);
  }

  private createFileWatcher(): Disposable
  {
    const watcher = workspace.createFileSystemWatcher('**/*', false, true, false);
    const handleStructureChange = (uri: Uri): void =>
    {
      if (this.stateStore.getActiveFilterId() === allFilterId)
      {
        return;
      }
      const folder = workspace.getWorkspaceFolder(uri);
      if (folder === undefined)
      {
        return;
      }
      const relativePath = workspace.asRelativePath(uri, false);
      if (relativePath === settingsFileRelativePath)
      {
        return;
      }
      const isLeafFolderName = this.leafFolderMatcherByFolder.get(folder.uri.toString());
      const segments = splitRelativePath(relativePath);
      if (isLeafFolderName !== undefined && segments.some((segment) => isLeafFolderName(segment)))
      {
        return;
      }
      this.scheduleRecompute(folder);
    };
    const subscriptions = [watcher.onDidCreate(handleStructureChange), watcher.onDidDelete(handleStructureChange)];
    return {
      dispose: (): void =>
      {
        for (const subscription of subscriptions)
        {
          subscription.dispose();
        }
        watcher.dispose();
      },
    };
  }

  private scheduleRecompute(folder: WorkspaceFolder): void
  {
    const folderKey = folder.uri.toString();
    const pendingTimeout = this.debounceByFolder.get(folderKey);
    if (pendingTimeout !== undefined)
    {
      clearTimeout(pendingTimeout);
    }
    this.debounceByFolder.set(folderKey, setTimeout(() =>
    {
      this.debounceByFolder.delete(folderKey);
      void this.recomputeFolder(folder, false);
    }, watcherDebounceMs));
  }

  private emitState(): void
  {
    this.stateEmitter.fire(this.getState());
  }
}

function buildPlanSignature(filter: ResolvedFilter, configuration: ResolvedConfiguration): string
{
  return JSON.stringify({
    base: filter.base,
    hide: filter.hidePatterns,
    show: filter.showPatterns,
    leafFolders: configuration.leafFolders,
    maxWalkEntries: configuration.maxWalkEntries,
  });
}

function buildBaselineSignature(baselineKeys: readonly string[]): string
{
  return [...baselineKeys].sort().join('\n');
}

function describeError(error: unknown): string
{
  return error instanceof Error ? error.message : String(error);
}
