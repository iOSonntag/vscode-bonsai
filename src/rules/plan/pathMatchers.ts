import { advanceMatchState, compileGlobPattern, createInitialMatchState, isFullMatch, type CompiledGlob } from '../glob/globPattern.js';
import { splitRelativePath } from '../paths/relativePath.js';

export type FolderNameMatcher = (folderName: string) => boolean;
export type RelativePathMatcher = (relativePath: string) => boolean;

/**
 * Builds a matcher that tests a folder name at any depth against name globs such as `bazel-*`.
 * A glob that is no folder name, see `isFolderNameGlob`, matches nothing.
 */
export function createFolderNameMatcher(nameGlobs: readonly string[], ignoreCase: boolean): FolderNameMatcher
{
  const globs = compileGlobList(nameGlobs.filter((nameGlob) => isFolderNameGlob(nameGlob)), ignoreCase);
  return (folderName) =>
    globs.some((glob) => isFullMatch(advanceMatchState(createInitialMatchState(glob), folderName)));
}

/** True when every brace alternative of the glob is one path segment, so that it can match a folder name. */
export function isFolderNameGlob(nameGlob: string): boolean
{
  return compileGlobPattern(nameGlob, { ignoreCase: false }).every((glob) => glob.segments.length === 1);
}

/** Builds a matcher that tests a workspace-relative path against full globs of the VS Code dialect. */
export function createRelativePathMatcher(patterns: readonly string[], ignoreCase: boolean): RelativePathMatcher
{
  const globs = compileGlobList(patterns, ignoreCase);
  return (relativePath) =>
  {
    const segments = splitRelativePath(relativePath);
    return globs.some((glob) =>
    {
      let state = createInitialMatchState(glob);
      for (const segment of segments)
      {
        state = advanceMatchState(state, segment);
      }
      return isFullMatch(state);
    });
  };
}

function compileGlobList(patterns: readonly string[], ignoreCase: boolean): CompiledGlob[]
{
  return patterns.flatMap((pattern) => compileGlobPattern(pattern, { ignoreCase }));
}
