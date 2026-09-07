import { promises as fileSystem } from 'node:fs';
import { type LogOutputChannel } from 'vscode';
import { type ManagedKeysFileEntry } from './cleanScript/managedKeysState.js';
import { stripManagedKeysFromSettings } from './cleanScript/stripManagedKeys.js';
import { runGitCommand, runGitCommandWithInput } from './gitCommandRunner.js';
import { type GitRepository } from './gitRepository.js';
import { parseStageZeroIndexEntry } from './indexEntry.js';

export type IndexRefreshOutcome = 'refreshed' | 'skippedDirty' | 'skippedUntracked' | 'skippedMissing' | 'failed';

/**
 * Clears the ghost "modified" mark that `git status` shows after a size change. It rewrites the
 * index entry with the object id it already has, which resets the cached size and time and
 * stages no content. It does that only when the stripped file content equals that object.
 */
export async function refreshSettingsFileIndexIfClean(
  repository: GitRepository,
  entry: ManagedKeysFileEntry,
  log: LogOutputChannel,
): Promise<IndexRefreshOutcome>
{
  let settingsText: string;
  try
  {
    settingsText = await fileSystem.readFile(repository.settingsFilePath, 'utf8');
  }
  catch
  {
    return 'skippedMissing';
  }
  const relativePath = repository.settingsFileRelativePath;
  const indexResult = await runGitCommand(repository.workTreePath, ['ls-files', '--stage', '--', relativePath]);
  const indexEntry = indexResult.exitCode === 0 ? parseStageZeroIndexEntry(indexResult.stdout) : undefined;
  if (indexEntry === undefined)
  {
    return 'skippedUntracked';
  }
  const strippedText = stripManagedKeysFromSettings(settingsText, {
    managedKeys: entry.managedKeys,
    removeExcludePropertyWhenEmpty: entry.createdExcludeProperty,
  });
  const hashResult = await runGitCommandWithInput(repository.workTreePath, ['hash-object', '--stdin'], strippedText);
  if (hashResult.exitCode !== 0)
  {
    return 'failed';
  }
  if (hashResult.stdout.trim() !== indexEntry.objectId)
  {
    return 'skippedDirty';
  }
  const refreshResult = await runGitCommand(repository.workTreePath, [
    'update-index',
    '--cacheinfo',
    `${indexEntry.mode},${indexEntry.objectId},${relativePath}`,
  ]);
  if (refreshResult.exitCode !== 0)
  {
    log.warn(`git update-index failed for ${relativePath}: ${refreshResult.stderr.trim()}`);
    return 'failed';
  }
  return 'refreshed';
}
