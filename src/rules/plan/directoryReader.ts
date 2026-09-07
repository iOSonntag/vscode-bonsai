export type DirectoryEntryKind = 'file' | 'directory' | 'symbolicLink' | 'unknown';

export interface DirectoryEntry
{
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

/** Lists one folder of a workspace folder. The root is the empty path. */
export interface DirectoryReader
{
  readDirectory(relativePath: string): Promise<readonly DirectoryEntry[]>;
}
