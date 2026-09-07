import { describe, expect, it } from 'vitest';
import { splitRelativePath } from '../paths/relativePath.js';
import {
  advanceMatchState,
  canMatchBelow,
  compileGlobPattern,
  createInitialMatchState,
  escapeGlobPath,
  isFullMatch,
  listResidualPatterns,
  type CompiledGlob,
  type GlobMatchState,
} from './globPattern.js';

function compileSingleGlob(pattern: string, ignoreCase = false): CompiledGlob
{
  const globs = compileGlobPattern(pattern, { ignoreCase });
  const glob = globs[0];
  if (glob === undefined || globs.length !== 1)
  {
    throw new Error(`Expected one glob for ${pattern}`);
  }
  return glob;
}

function advanceOverPath(glob: CompiledGlob, relativePath: string): GlobMatchState
{
  let state = createInitialMatchState(glob);
  for (const segment of splitRelativePath(relativePath))
  {
    state = advanceMatchState(state, segment);
  }
  return state;
}

function matchesPath(pattern: string, relativePath: string, ignoreCase = false): boolean
{
  return isFullMatch(advanceOverPath(compileSingleGlob(pattern, ignoreCase), relativePath));
}

describe('compileGlobPattern', () =>
{
  it('expands brace alternatives into several globs', () =>
  {
    const sources = compileGlobPattern('**/*.{ts,tsx}', { ignoreCase: false }).map((glob) => glob.source);
    expect(sources).toEqual(['**/*.ts', '**/*.tsx']);
  });

  it('strips a trailing slash and collapses consecutive globstars', () =>
  {
    expect(compileSingleGlob('dist/').source).toBe('dist');
    expect(compileSingleGlob('**/**/x').segments).toHaveLength(2);
  });

  it('yields no glob for an empty pattern', () =>
  {
    expect(compileGlobPattern('   ', { ignoreCase: false })).toEqual([]);
  });
});

describe('isFullMatch', () =>
{
  it('anchors a pattern without a leading globstar at the root', () =>
  {
    expect(matchesPath('src/legacy', 'src/legacy')).toBe(true);
    expect(matchesPath('src/legacy', 'packages/src/legacy')).toBe(false);
  });

  it('lets a leading globstar match at any depth, including the root', () =>
  {
    expect(matchesPath('**/CLAUDE.md', 'CLAUDE.md')).toBe(true);
    expect(matchesPath('**/CLAUDE.md', 'packages/app/CLAUDE.md')).toBe(true);
  });

  it('lets a trailing globstar match the folder itself and everything below', () =>
  {
    expect(matchesPath('.claude/**', '.claude')).toBe(true);
    expect(matchesPath('.claude/**', '.claude/rules/a.md')).toBe(true);
    expect(matchesPath('.claude/**', '.cursor')).toBe(false);
  });

  it('supports star, question mark, and character classes', () =>
  {
    expect(matchesPath('*.log', 'debug.log')).toBe(true);
    expect(matchesPath('*.log', 'logs/debug.log')).toBe(false);
    expect(matchesPath('file?.txt', 'file1.txt')).toBe(true);
    expect(matchesPath('file?.txt', 'file10.txt')).toBe(false);
    expect(matchesPath('example.[!0-9]', 'example.a')).toBe(true);
    expect(matchesPath('example.[!0-9]', 'example.1')).toBe(false);
    expect(matchesPath('example.[0-9]', 'example.1')).toBe(true);
  });

  it('treats a dot in a pattern literally', () =>
  {
    expect(matchesPath('.env', 'aenv')).toBe(false);
    expect(matchesPath('.env*', '.env.local')).toBe(true);
  });

  it('treats a malformed character class as literal text instead of throwing', () =>
  {
    expect(matchesPath('file[9-0].txt', 'file[9-0].txt')).toBe(true);
    expect(matchesPath('file[9-0].txt', 'file5.txt')).toBe(false);
  });

  it('matches an escaped key only against the literal name', () =>
  {
    expect(escapeGlobPath('app/[id]/page.tsx')).toBe('app/[[]id[]]/page.tsx');
    expect(matchesPath(escapeGlobPath('app/[id]'), 'app/[id]')).toBe(true);
    expect(matchesPath(escapeGlobPath('app/[id]'), 'app/i')).toBe(false);
    expect(matchesPath(escapeGlobPath('a*b?c{d}'), 'a*b?c{d}')).toBe(true);
    expect(matchesPath(escapeGlobPath('a*b?c{d}'), 'axbycd')).toBe(false);
  });

  it('honors the ignoreCase option', () =>
  {
    expect(matchesPath('README.md', 'readme.md')).toBe(false);
    expect(matchesPath('README.md', 'readme.md', true)).toBe(true);
  });
});

describe('canMatchBelow', () =>
{
  it('reports reach for a globstar pattern in every folder', () =>
  {
    const state = advanceOverPath(compileSingleGlob('**/*.log'), 'src/deep');
    expect(canMatchBelow(state)).toBe(true);
    expect(isFullMatch(state)).toBe(false);
  });

  it('reports no reach for an anchored pattern in an unrelated folder', () =>
  {
    expect(canMatchBelow(advanceOverPath(compileSingleGlob('docs/keep.log'), 'src'))).toBe(false);
    expect(canMatchBelow(advanceOverPath(compileSingleGlob('docs/keep.log'), 'docs'))).toBe(true);
    expect(canMatchBelow(advanceOverPath(compileSingleGlob('docs/keep.log'), 'docs/sub'))).toBe(false);
  });

  it('reports no reach once a pattern matched a file exactly', () =>
  {
    const state = advanceOverPath(compileSingleGlob('docs/keep.log'), 'docs/keep.log');
    expect(isFullMatch(state)).toBe(true);
    expect(canMatchBelow(state)).toBe(false);
  });
});

describe('listResidualPatterns', () =>
{
  it('rebases a globstar pattern and drops the covered remainder', () =>
  {
    const state = advanceOverPath(compileSingleGlob('**/*.log'), 'src/vendor');
    expect(listResidualPatterns(state)).toEqual(['**/*.log']);
  });

  it('returns the remainder of an anchored pattern', () =>
  {
    const state = advanceOverPath(compileSingleGlob('docs/**/api/*.md'), 'docs');
    expect(listResidualPatterns(state)).toEqual(['**/api/*.md']);
  });

  it('returns nothing when the pattern cannot match below', () =>
  {
    expect(listResidualPatterns(advanceOverPath(compileSingleGlob('src/a.ts'), 'docs'))).toEqual([]);
  });
});
