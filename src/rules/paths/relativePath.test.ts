import { describe, expect, it } from 'vitest';
import { isPathBelowFolder } from './relativePath.js';

describe('isPathBelowFolder', () =>
{
  it('is true for a path strictly below the folder', () =>
  {
    expect(isPathBelowFolder('.claude/worktrees/a/node_modules/x', '.claude/worktrees/a')).toBe(true);
    expect(isPathBelowFolder('wt\\src\\a.ts', 'wt')).toBe(true);
  });

  it('is false for the folder itself, a sibling that shares its name as a prefix, and an ancestor', () =>
  {
    expect(isPathBelowFolder('.claude/worktrees/a', '.claude/worktrees/a')).toBe(false);
    expect(isPathBelowFolder('.claude/worktrees/ab/x', '.claude/worktrees/a')).toBe(false);
    expect(isPathBelowFolder('.claude/worktrees', '.claude/worktrees/a')).toBe(false);
  });

  it('treats every path as below the root', () =>
  {
    expect(isPathBelowFolder('src/a.ts', '')).toBe(true);
    expect(isPathBelowFolder('', '')).toBe(false);
  });
});
