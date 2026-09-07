import { advanceMatchState, compileGlobPattern, createInitialMatchState, isFullMatch, type CompiledGlob } from '../glob/globPattern.js';
import { splitRelativePath } from '../paths/relativePath.js';

export type FolderNameMatcher = (folderName: string) => boolean;
export type RelativePathMatcher = (relativePath: string) => boolean;

/** Builds a matcher that tests a folder name at any depth against name globs such as `bazel-*`. */
export function createFolderNameMatcher(nameGlobs: readonly string[], ignoreCase: boolean): FolderNameMatcher
{
  const globs = compileGlobList(nameGlobs, ignoreCase).filter((glob) => glob.segments.length === 1);
  return (folderName) =>
    globs.some((glob) => isFullMatch(advanceMatchState(createInitialMatchState(glob), folderName)));
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
