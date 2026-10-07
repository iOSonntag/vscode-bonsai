import { describe, expect, it } from 'vitest';
import { createFolderNameMatcher, isFolderNameGlob } from './pathMatchers.js';

describe('isFolderNameGlob', () =>
{
  it('accepts a folder name glob, also with a trailing slash or brace alternatives', () =>
  {
    expect(isFolderNameGlob('worktrees')).toBe(true);
    expect(isFolderNameGlob('bazel-*')).toBe(true);
    expect(isFolderNameGlob('node_modules/')).toBe(true);
    expect(isFolderNameGlob('{dist,out}')).toBe(true);
  });

  it('rejects a glob with more than one segment in any alternative', () =>
  {
    expect(isFolderNameGlob('.claude/worktrees')).toBe(false);
    expect(isFolderNameGlob('**/dist')).toBe(false);
    expect(isFolderNameGlob('{dist,build/out}')).toBe(false);
  });
});

describe('createFolderNameMatcher', () =>
{
  it('matches folder names and ignores a glob that holds a path', () =>
  {
    const isLeafFolderName = createFolderNameMatcher(['bazel-*', '.claude/worktrees'], false);
    expect(isLeafFolderName('bazel-out')).toBe(true);
    expect(isLeafFolderName('worktrees')).toBe(false);
    expect(isLeafFolderName('.claude')).toBe(false);
  });
});
