import { type Memento, type WorkspaceFolder } from 'vscode';
import { allFilterId } from '../rules/catalog/filterCatalog.js';

/** A cached plan: the generated keys of one folder and one filter from the last walk. */
export interface CachedPlan
{
  /** Identifies the patterns and limits that produced the plan. A different signature makes the plan stale. */
  readonly signature: string;
  readonly globEntries: readonly string[];
  readonly concreteEntries: readonly string[];
  /** The nested checkouts the walk did not open, so that file events below them are dropped before the walk ends. */
  readonly checkoutFolders: readonly string[];
}

/** A cached plan as the workspace state holds it. A plan cached before checkout detection lacks checkout folders. */
interface StoredCachedPlan
{
  readonly signature: string;
  readonly globEntries: readonly string[];
  readonly concreteEntries: readonly string[];
  readonly checkoutFolders?: readonly string[];
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
    if (cachedPlan?.signature !== signature)
    {
      return undefined;
    }
    return {
      signature: cachedPlan.signature,
      globEntries: cachedPlan.globEntries,
      concreteEntries: cachedPlan.concreteEntries,
      checkoutFolders: cachedPlan.checkoutFolders ?? [],
    };
  }

  public async setCachedPlan(folder: WorkspaceFolder, filterId: string, plan: CachedPlan): Promise<void>
  {
    const planCache = { ...this.readPlanCache() };
    planCache[planKeyFor(folder, filterId)] = {
      signature: plan.signature,
      globEntries: [...plan.globEntries],
      concreteEntries: [...plan.concreteEntries],
      checkoutFolders: [...plan.checkoutFolders],
    };
    await this.memento.update(planCacheKey, planCache);
  }

  private readManagedKeysByFolder(): Record<string, ManagedKeysRecord>
  {
    return this.memento.get<Record<string, ManagedKeysRecord>>(managedKeysKey, {});
  }

  private readPlanCache(): Record<string, StoredCachedPlan>
  {
    return this.memento.get<Record<string, StoredCachedPlan>>(planCacheKey, {});
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
