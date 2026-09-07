import { type Memento, type WorkspaceFolder } from 'vscode';
import { allFilterId } from '../rules/catalog/filterCatalog.js';

/** A cached plan: the generated keys of one folder and one filter from the last walk. */
export interface CachedPlan
{
  /** Identifies the patterns and limits that produced the plan. A different signature makes the plan stale. */
  readonly signature: string;
  readonly globEntries: readonly string[];
  readonly concreteEntries: readonly string[];
}

/** The generated keys that Bonsai owns in one folder, and whether it created the exclude property itself. */
export interface ManagedKeysRecord
{
  readonly keys: readonly string[];
  readonly createdExcludeProperty: boolean;
}

const emptyRecord: ManagedKeysRecord = { keys: [], createdExcludeProperty: false };

const activeFilterKey = 'bonsai.activeFilterId';
const managedKeysKey = 'bonsai.managedKeysByFolder';
const planCacheKey = 'bonsai.planCacheByFolderAndFilter';

/** Persists the active filter, the managed keys per folder, and the plan cache in the workspace state. */
export class FilterStateStore
{
  public constructor(private readonly memento: Memento)
  {
  }

  public getActiveFilterId(): string
  {
    return this.memento.get<string>(activeFilterKey, allFilterId);
  }

  public async setActiveFilterId(filterId: string): Promise<void>
  {
    await this.memento.update(activeFilterKey, filterId);
  }

  public getManagedKeys(folder: WorkspaceFolder): readonly string[]
  {
    return this.getManagedKeysRecord(folder).keys;
  }

  public getManagedKeysRecord(folder: WorkspaceFolder): ManagedKeysRecord
  {
    return this.readManagedKeysByFolder()[folderKeyFor(folder)] ?? emptyRecord;
  }

  public async setManagedKeysRecord(folder: WorkspaceFolder, record: ManagedKeysRecord): Promise<void>
  {
    const managedKeysByFolder = { ...this.readManagedKeysByFolder() };
    if (record.keys.length === 0 && !record.createdExcludeProperty)
    {
      Reflect.deleteProperty(managedKeysByFolder, folderKeyFor(folder));
    }
    else
    {
      managedKeysByFolder[folderKeyFor(folder)] = {
        keys: [...record.keys],
        createdExcludeProperty: record.createdExcludeProperty,
      };
    }
    await this.memento.update(managedKeysKey, managedKeysByFolder);
  }

  public getCachedPlan(folder: WorkspaceFolder, filterId: string, signature: string): CachedPlan | undefined
  {
    const cachedPlan = this.readPlanCache()[planKeyFor(folder, filterId)];
    return cachedPlan?.signature === signature ? cachedPlan : undefined;
  }

  public async setCachedPlan(folder: WorkspaceFolder, filterId: string, plan: CachedPlan): Promise<void>
  {
    const planCache = { ...this.readPlanCache() };
    planCache[planKeyFor(folder, filterId)] = {
      signature: plan.signature,
      globEntries: [...plan.globEntries],
      concreteEntries: [...plan.concreteEntries],
    };
    await this.memento.update(planCacheKey, planCache);
  }

  private readManagedKeysByFolder(): Record<string, ManagedKeysRecord>
  {
    return this.memento.get<Record<string, ManagedKeysRecord>>(managedKeysKey, {});
  }

  private readPlanCache(): Record<string, CachedPlan>
  {
    return this.memento.get<Record<string, CachedPlan>>(planCacheKey, {});
  }
}

function folderKeyFor(folder: WorkspaceFolder): string
{
  return folder.uri.toString();
}

function planKeyFor(folder: WorkspaceFolder, filterId: string): string
{
  return `${folderKeyFor(folder)}|${filterId}`;
}
