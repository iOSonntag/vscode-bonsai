import { window, workspace, type Disposable, type ExtensionContext, type LogOutputChannel, type WorkspaceFolder } from 'vscode';
import { type BonsaiConfigurationService } from '../configuration/bonsaiConfigurationService.js';
import { type FilterSession } from '../explorer/filterSession.js';
import { type FilterStateStore } from '../explorer/filterStateStore.js';
import { CleanFilterInstaller } from './cleanFilterInstaller.js';
import { findGitRepositoryForFolder, type GitRepository } from './gitRepository.js';
import { refreshSettingsFileIndexIfClean } from './safeIndexRefresh.js';

type RepositoryDecision = 'accepted' | 'declined';

const decisionsStateKey = 'bonsai.git.decisionByRepository';
const setUpAction = 'Set up';
const notNowAction = 'Not now';
const neverAction = 'Never for this repository';

/**
 * Keeps the generated keys out of Git: it installs the local clean filter after one prompt,
 * keeps the state file current, repairs a broken setup, and clears the ghost "modified" mark.
 */
export class GitIntegration implements Disposable
{
  private readonly installer: CleanFilterInstaller;
  private readonly repositoryByFolder = new Map<string, Promise<GitRepository | undefined>>();
  private readonly skippedThisSession = new Set<string>();
  private queue: Promise<void> = Promise.resolve();
  private readonly disposables: Disposable[] = [];

  public constructor(
    private readonly context: ExtensionContext,
    private readonly configurationService: BonsaiConfigurationService,
    private readonly stateStore: FilterStateStore,
    private readonly session: FilterSession,
    private readonly log: LogOutputChannel,
  )
  {
    this.installer = new CleanFilterInstaller(context.extensionUri, context.globalStorageUri, log);
  }

  public start(): void
  {
    this.disposables.push(this.session.onDidWriteExcludeSetting((event) =>
    {
      this.enqueueForFolder(event.folder, () => this.synchronizeAfterWrite(event.folder));
    }));
    for (const folder of workspace.workspaceFolders ?? [])
    {
      this.enqueueForFolder(folder, () => this.repairOnStart(folder));
    }
  }

  public async installForAllFolders(): Promise<void>
  {
    for (const folder of workspace.workspaceFolders ?? [])
    {
      const repository = await this.findRepository(folder);
      if (repository === undefined)
      {
        continue;
      }
      await this.installer.install(repository);
      await this.storeDecision(repository, 'accepted');
      await this.installer.writeStateEntry(repository, this.readStateEntry(folder));
    }
    void window.showInformationMessage('Bonsai set up the Git clean filter for every repository in this workspace.');
  }

  public async uninstallForAllFolders(): Promise<void>
  {
    for (const folder of workspace.workspaceFolders ?? [])
    {
      const repository = await this.findRepository(folder);
      if (repository !== undefined)
      {
        await this.installer.uninstall(repository);
        await this.storeDecision(repository, 'declined');
      }
    }
    void window.showInformationMessage('Bonsai removed the Git clean filter from every repository in this workspace.');
  }

  public async reportStatusForAllFolders(): Promise<void>
  {
    const lines: string[] = [];
    for (const folder of workspace.workspaceFolders ?? [])
    {
      const repository = await this.findRepository(folder);
      if (repository === undefined)
      {
        lines.push(`${folder.name}: not inside a Git repository.`);
        continue;
      }
      const status = await this.installer.checkStatus(repository);
      const state = this.installer.isHealthy(status)
        ? 'installed and healthy'
        : this.installer.isInstalled(status)
          ? 'installed but needs repair'
          : 'not installed';
      lines.push(`${folder.name}: ${state} (attributes ${status.hasAttributesLine ? 'ok' : 'missing'}, `
        + `command ${status.hasCleanCommand ? (status.isCleanCommandCurrent ? 'ok' : 'stale') : 'missing'}, `
        + `script ${status.isScriptCurrent ? 'ok' : 'stale'}, runtime ${status.isRuntimeWorking ? 'ok' : 'missing'}).`);
    }
    this.log.info(lines.join('\n'));
    this.log.show(true);
  }

  public dispose(): void
  {
    for (const disposable of this.disposables)
    {
      disposable.dispose();
    }
  }

  /** One queue for every folder, because several folders can share one repository and its files. */
  private enqueueForFolder(folder: WorkspaceFolder, work: () => Promise<void>): void
  {
    this.queue = this.queue.then(work).catch((error: unknown) =>
    {
      this.log.error(`Git integration failed for ${folder.name}: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private async repairOnStart(folder: WorkspaceFolder): Promise<void>
  {
    const repository = await this.findRepository(folder);
    if (repository === undefined)
    {
      return;
    }
    const status = await this.installer.checkStatus(repository);
    if (!this.installer.isInstalled(status))
    {
      return;
    }
    if (!this.installer.isHealthy(status))
    {
      this.log.info(`Repairing the Git clean filter in ${repository.workTreePath}.`);
      await this.installer.install(repository);
    }
    await this.installer.writeStateEntry(repository, this.readStateEntry(folder));
  }

  private async synchronizeAfterWrite(folder: WorkspaceFolder): Promise<void>
  {
    const repository = await this.findRepository(folder);
    if (repository === undefined)
    {
      return;
    }
    const mode = this.configurationService.resolveForFolder(folder).cleanFilterMode;
    if (mode === 'never')
    {
      return;
    }
    const status = await this.installer.checkStatus(repository);
    if (!this.installer.isInstalled(status))
    {
      const decision = await this.decideInstallation(repository, mode);
      if (decision !== 'accepted')
      {
        return;
      }
      await this.installer.install(repository);
    }
    else if (!this.installer.isHealthy(status))
    {
      await this.installer.install(repository);
    }
    const entry = this.readStateEntry(folder);
    await this.installer.writeStateEntry(repository, entry);
    const outcome = await refreshSettingsFileIndexIfClean(repository, entry, this.log);
    this.log.debug(`Index refresh for ${repository.settingsFileRelativePath}: ${outcome}.`);
  }

  private async decideInstallation(repository: GitRepository, mode: 'ask' | 'always'): Promise<RepositoryDecision | undefined>
  {
    if (mode === 'always')
    {
      return 'accepted';
    }
    const storedDecision = this.readDecisions()[repository.gitDirectoryPath];
    if (storedDecision !== undefined)
    {
      return storedDecision;
    }
    if (this.skippedThisSession.has(repository.gitDirectoryPath))
    {
      return undefined;
    }
    const choice = await window.showInformationMessage(
      'Bonsai can keep its generated keys out of Git with a local clean filter. Set it up for this repository?',
      setUpAction,
      notNowAction,
      neverAction,
    );
    if (choice === setUpAction)
    {
      await this.storeDecision(repository, 'accepted');
      return 'accepted';
    }
    if (choice === neverAction)
    {
      await this.storeDecision(repository, 'declined');
      return 'declined';
    }
    this.skippedThisSession.add(repository.gitDirectoryPath);
    return undefined;
  }

  private findRepository(folder: WorkspaceFolder): Promise<GitRepository | undefined>
  {
    const folderKey = folder.uri.toString();
    const cached = this.repositoryByFolder.get(folderKey);
    if (cached !== undefined)
    {
      return cached;
    }
    const lookup = findGitRepositoryForFolder(folder);
    this.repositoryByFolder.set(folderKey, lookup);
    return lookup;
  }

  private readStateEntry(folder: WorkspaceFolder): { managedKeys: readonly string[]; createdExcludeProperty: boolean }
  {
    const record = this.stateStore.getManagedKeysRecord(folder);
    return { managedKeys: record.keys, createdExcludeProperty: record.createdExcludeProperty };
  }

  private readDecisions(): Record<string, RepositoryDecision>
  {
    return this.context.globalState.get<Record<string, RepositoryDecision>>(decisionsStateKey, {});
  }

  private async storeDecision(repository: GitRepository, decision: RepositoryDecision): Promise<void>
  {
    await this.context.globalState.update(decisionsStateKey, {
      ...this.readDecisions(),
      [repository.gitDirectoryPath]: decision,
    });
  }
}
