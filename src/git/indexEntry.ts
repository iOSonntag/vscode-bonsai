/** One entry of the Git index as `git ls-files --stage` prints it. */
export interface IndexEntry
{
  readonly mode: string;
  readonly objectId: string;
}

/**
 * Parses the output of `git ls-files --stage` for one path. Returns the entry only when the path
 * has exactly one entry at stage 0. A conflict or an untracked path yields undefined.
 */
export function parseStageZeroIndexEntry(lsFilesOutput: string): IndexEntry | undefined
{
  const lines = lsFilesOutput.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const firstLine = lines[0];
  if (lines.length !== 1 || firstLine === undefined)
  {
    return undefined;
  }
  const match = /^(\d{6}) ([0-9a-f]{40,64}) (\d)\t/.exec(firstLine);
  if (match?.[3] !== '0')
  {
    return undefined;
  }
  const mode = match[1];
  const objectId = match[2];
  if (mode === undefined || objectId === undefined)
  {
    return undefined;
  }
  return { mode, objectId };
}
