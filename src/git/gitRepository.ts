import { promises as fileSystem } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { type WorkspaceFolder } from 'vscode';
import { normalizeStatePath } from './cleanScript/managedKeysState.js';
import { runGitCommand } from './gitCommandRunner.js';

/** A Git repository that holds a workspace folder. */
export interface GitRepository
{
  /** The absolute path of the working tree root. */
  readonly workTreePath: string;
  /** The absolute path of the per-worktree Git directory. */
  readonly gitDirectoryPath: string;
  /** The absolute path of the `info/attributes` file, shared by every worktree of the repository. */
  readonly attributesFilePath: string;
  /** The absolute path of the Bonsai state file inside the Git directory. */
  readonly stateFilePath: string;
  /** The settings file of the workspace folder, relative to the working tree root, with forward slashes. */
  readonly settingsFileRelativePath: string;
  /** The absolute path of the settings file of the workspace folder. */
  readonly settingsFilePath: string;
}

const settingsFileSegments = ['.vscode', 'settings.json'];

/** Finds the repository of a local workspace folder. Returns undefined when the folder is not inside one. */
export async function findGitRepositoryForFolder(folder: WorkspaceFolder): Promise<GitRepository | undefined>
{
  if (folder.uri.scheme !== 'file')
  {
    return undefined;
  }
  let folderPath: string;
  try
  {
    folderPath = await fileSystem.realpath(folder.uri.fsPath);
  }
  catch
  {
    return undefined;
  }
  const result = await runGitCommand(folderPath, [
    'rev-parse',
    '--show-toplevel',
    '--git-dir',
    '--git-path',
    'info/attributes',
    '--git-path',
    'bonsai/managed-keys.json',
  ]);
  if (result.exitCode !== 0)
  {
    return undefined;
  }
  const [topLevel, gitDirectory, attributesPath, statePath] = result.stdout.split(/\r?\n/).map((line) => line.trim());
  if (topLevel === undefined || gitDirectory === undefined || attributesPath === undefined || statePath === undefined)
  {
    return undefined;
  }
  if (topLevel.length === 0 || gitDirectory.length === 0)
  {
    return undefined;
  }
  const workTreePath = resolve(topLevel);
  const resolveFromWorkTree = (path: string): string => (isAbsolute(path) ? path : resolve(workTreePath, path));
  const settingsFilePath = resolve(folderPath, ...settingsFileSegments);
  const settingsFileRelativePath = relative(workTreePath, settingsFilePath);
  if (isAbsolute(settingsFileRelativePath) || settingsFileRelativePath.startsWith('..'))
  {
    return undefined;
  }
  return {
    workTreePath,
    gitDirectoryPath: resolveFromWorkTree(gitDirectory),
    attributesFilePath: resolveFromWorkTree(attributesPath),
    stateFilePath: resolveFromWorkTree(statePath),
    settingsFileRelativePath: normalizeStatePath(settingsFileRelativePath),
    settingsFilePath,
  };
}
