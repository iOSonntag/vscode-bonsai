import { ConfigurationTarget, workspace, type LogOutputChannel, type WorkspaceFolder } from 'vscode';
import { type ManagedKeysRecord } from './filterStateStore.js';

const filesSection = 'files';
const excludeKey = 'exclude';

type ExcludeValue = Record<string, unknown>;

export interface ManagedKeysUpdate
{
  /** What Bonsai owns after the write: the requested keys that were not already present. */
  readonly record: ManagedKeysRecord;
  readonly didWrite: boolean;
}

/**
 * Writes generated keys into the exclude setting of a workspace folder and removes them again.
 * Only keys that Bonsai added are ever removed. Keys that were present before stay untouched.
 */
export class ExcludeSettingWriter
{
  public constructor(private readonly log: LogOutputChannel)
  {
  }

  /** The effective exclude keys with value `true`, minus the managed keys. */
  public readBaselineKeys(folder: WorkspaceFolder, managedKeys: readonly string[]): string[]
  {
    const effectiveValue = workspace.getConfiguration(filesSection, folder.uri).get<ExcludeValue>(excludeKey, {});
    const managedKeySet = new Set(managedKeys);
    return Object.entries(effectiveValue)
      .filter(([key, value]) => value === true && !managedKeySet.has(key))
      .map(([key]) => key);
  }

  /** True when every managed key is present with value `true` in the folder scope. */
  public areManagedKeysPresent(folder: WorkspaceFolder, managedKeys: readonly string[]): boolean
  {
    const scopeValue = this.readScopeValue(folder);
    return managedKeys.every((key) => scopeValue?.[key] === true);
  }

  /** Replaces the previously managed keys with the next keys in the folder scope. */
  public async replaceManagedKeys(
    folder: WorkspaceFolder,
    previous: ManagedKeysRecord,
    nextKeys: readonly string[],
  ): Promise<ManagedKeysUpdate>
  {
    const scopeValue = this.readScopeValue(folder);
    const nextValue: ExcludeValue = { ...(scopeValue ?? {}) };
    for (const key of previous.keys)
    {
      Reflect.deleteProperty(nextValue, key);
    }
    const managedKeys: string[] = [];
    for (const key of nextKeys)
    {
      if (Object.hasOwn(nextValue, key))
      {
        continue;
      }
      nextValue[key] = true;
      managedKeys.push(key);
    }
    const createdExcludeProperty = previous.createdExcludeProperty || scopeValue === undefined;
    const isEmptyAfterWrite = Object.keys(nextValue).length === 0;
    const removesProperty = isEmptyAfterWrite && createdExcludeProperty;
    const record: ManagedKeysRecord = {
      keys: managedKeys,
      createdExcludeProperty: createdExcludeProperty && !removesProperty,
    };
    const hasChanged = removesProperty ? scopeValue !== undefined : !areExcludeValuesEqual(scopeValue ?? {}, nextValue);
    if (!hasChanged)
    {
      return { record, didWrite: false };
    }
    const valueToWrite = removesProperty ? undefined : nextValue;
    await workspace.getConfiguration(filesSection, folder.uri).update(excludeKey, valueToWrite, this.targetFor());
    this.log.info(`Wrote ${managedKeys.length} generated keys for ${folder.name}.`);
    return { record, didWrite: true };
  }

  private readScopeValue(folder: WorkspaceFolder): ExcludeValue | undefined
  {
    const inspection = workspace.getConfiguration(filesSection, folder.uri).inspect<ExcludeValue>(excludeKey);
    if (inspection === undefined)
    {
      return undefined;
    }
    return this.targetFor() === ConfigurationTarget.Workspace
      ? inspection.workspaceValue
      : inspection.workspaceFolderValue;
  }

  private targetFor(): ConfigurationTarget
  {
    return workspace.workspaceFile === undefined ? ConfigurationTarget.Workspace : ConfigurationTarget.WorkspaceFolder;
  }
}

function areExcludeValuesEqual(first: ExcludeValue, second: ExcludeValue): boolean
{
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  if (firstKeys.length !== secondKeys.length)
  {
    return false;
  }
  return firstKeys.every((key) => Object.hasOwn(second, key) && first[key] === second[key]);
}
