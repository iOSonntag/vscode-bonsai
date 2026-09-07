import { appendPathSegment, splitRelativePath } from '../paths/relativePath.js';
import { type DirectoryEntry, type DirectoryEntryKind, type DirectoryReader } from './directoryReader.js';

/** A directory reader over an in-memory tree, and a count of the listings it served. */
export interface MemoryDirectoryReader extends DirectoryReader
{
  readonly readPaths: readonly string[];
}

/**
 * Builds a reader from path strings. A trailing slash marks a folder, a trailing `@` marks
 * a symbolic link. Parent folders are created as needed.
 */
export function createMemoryDirectoryReader(paths: readonly string[]): MemoryDirectoryReader
{
  const childrenByFolder = new Map<string, Map<string, DirectoryEntryKind>>();
  const ensureFolder = (folderPath: string): Map<string, DirectoryEntryKind> =>
  {
    const existingChildren = childrenByFolder.get(folderPath);
    if (existingChildren !== undefined)
    {
      return existingChildren;
    }
    const children = new Map<string, DirectoryEntryKind>();
    childrenByFolder.set(folderPath, children);
    return children;
  };
  ensureFolder('');
  for (const path of paths)
  {
    const kind: DirectoryEntryKind = path.endsWith('/') ? 'directory' : path.endsWith('@') ? 'symbolicLink' : 'file';
    const segments = splitRelativePath(path.replace(/@$/, ''));
    let folderPath = '';
    for (const [index, segment] of segments.entries())
    {
      const isLast = index === segments.length - 1;
      const children = ensureFolder(folderPath);
      const childKind: DirectoryEntryKind = isLast ? kind : 'directory';
      children.set(segment, children.get(segment) === 'directory' ? 'directory' : childKind);
      folderPath = appendPathSegment(folderPath, segment);
      if (childKind === 'directory')
      {
        ensureFolder(folderPath);
      }
    }
  }
  const readPaths: string[] = [];
  return {
    readPaths,
    readDirectory: (relativePath: string): Promise<readonly DirectoryEntry[]> =>
    {
      readPaths.push(relativePath);
      const children = childrenByFolder.get(relativePath);
      if (children === undefined)
      {
        return Promise.reject(new Error(`Folder not found: ${relativePath}`));
      }
      const entries = [...children.entries()]
        .map(([name, kind]): DirectoryEntry => ({ name, kind }))
        .sort((first, second) => first.name.localeCompare(second.name));
      return Promise.resolve(entries);
    },
  };
}
