/** The state file that the clean script reads. It lives inside the Git directory. */
export interface ManagedKeysStateFile
{
  readonly version: 1;
  /** Keyed by the settings file path relative to the repository root, with forward slashes. */
  readonly files: Readonly<Record<string, ManagedKeysFileEntry>>;
}

export interface ManagedKeysFileEntry
{
  readonly managedKeys: readonly string[];
  readonly createdExcludeProperty: boolean;
}

export const managedKeysStateFileVersion = 1;

/** Parses the state file text. Returns undefined for anything that is not a version 1 state file. */
export function parseManagedKeysStateFile(text: string): ManagedKeysStateFile | undefined
{
  let parsed: unknown;
  try
  {
    parsed = JSON.parse(text);
  }
  catch
  {
    return undefined;
  }
  if (!isRecord(parsed))
  {
    return undefined;
  }
  const rawFiles = parsed['files'];
  if (parsed['version'] !== managedKeysStateFileVersion || !isRecord(rawFiles))
  {
    return undefined;
  }
  const files: Record<string, ManagedKeysFileEntry> = {};
  for (const [path, entry] of Object.entries(rawFiles))
  {
    if (!isRecord(entry))
    {
      continue;
    }
    const managedKeys = entry['managedKeys'];
    if (!isStringArray(managedKeys))
    {
      continue;
    }
    files[normalizeStatePath(path)] = {
      managedKeys,
      createdExcludeProperty: entry['createdExcludeProperty'] === true,
    };
  }
  return { version: managedKeysStateFileVersion, files };
}

/** Normalizes a repository-relative path: forward slashes, no leading `./`, no wrapping shell quotes. */
export function normalizeStatePath(path: string): string
{
  return path.replace(/^['"]|['"]$/g, '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function isStringArray(value: unknown): value is string[]
{
  if (!Array.isArray(value))
  {
    return false;
  }
  return value.every((item: unknown) => typeof item === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown>
{
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
