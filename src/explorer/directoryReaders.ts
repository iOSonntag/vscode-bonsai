import { promises as fileSystem } from 'node:fs';
import { join } from 'node:path';
import { FileType, Uri, workspace, type WorkspaceFolder } from 'vscode';
import { type DirectoryEntry, type DirectoryEntryKind, type DirectoryReader } from '../rules/plan/directoryReader.js';

/** Picks the fastest reader for a workspace folder: Node for local folders, the VS Code file system otherwise. */
export function createDirectoryReaderForFolder(folder: WorkspaceFolder): DirectoryReader
{
  if (folder.uri.scheme === 'file')
  {
    return createNodeDirectoryReader(folder.uri.fsPath);
  }
  return createWorkspaceFileSystemReader(folder.uri);
}

function createNodeDirectoryReader(rootPath: string): DirectoryReader
{
  return {
    readDirectory: async (relativePath: string): Promise<readonly DirectoryEntry[]> =>
    {
      try
      {
        const entries = await fileSystem.readdir(join(rootPath, relativePath), { withFileTypes: true });
        return entries.map((entry): DirectoryEntry =>
        {
          const kind: DirectoryEntryKind = entry.isSymbolicLink()
            ? 'symbolicLink'
            : entry.isDirectory()
              ? 'directory'
              : entry.isFile()
                ? 'file'
                : 'unknown';
          return { name: entry.name, kind };
        });
      }
      catch
      {
        return [];
      }
    },
  };
}

function createWorkspaceFileSystemReader(rootUri: Uri): DirectoryReader
{
  return {
    readDirectory: async (relativePath: string): Promise<readonly DirectoryEntry[]> =>
    {
      try
      {
        const entries = await workspace.fs.readDirectory(Uri.joinPath(rootUri, relativePath));
        return entries.map(([name, fileType]): DirectoryEntry =>
        {
          const isSymbolicLink = (fileType & FileType.SymbolicLink) !== 0;
          const kind: DirectoryEntryKind = isSymbolicLink
            ? 'symbolicLink'
            : (fileType & FileType.Directory) !== 0
              ? 'directory'
              : (fileType & FileType.File) !== 0
                ? 'file'
                : 'unknown';
          return { name, kind };
        });
      }
      catch
      {
        return [];
      }
    },
  };
}
