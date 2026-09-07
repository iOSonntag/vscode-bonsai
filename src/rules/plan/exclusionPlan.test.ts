import { describe, expect, it } from 'vitest';
import { type ResolvedFilter } from '../catalog/filterCatalog.js';
import { computeExclusionPlan, WalkCancelledError, type ExclusionPlanRequest } from './exclusionPlan.js';
import { createMemoryDirectoryReader } from './memoryDirectoryReader.js';
import { createFolderNameMatcher, createRelativePathMatcher } from './pathMatchers.js';

interface ScenarioOptions
{
  readonly base: ResolvedFilter['base'];
  readonly hide?: readonly string[];
  readonly show?: readonly string[];
  readonly tree: readonly string[];
  readonly leafFolders?: readonly string[];
  readonly baseline?: readonly string[];
  readonly maxEntries?: number;
  readonly cancellation?: ExclusionPlanRequest['cancellation'];
}

function buildRequest(options: ScenarioOptions): ExclusionPlanRequest & { readonly readPaths: readonly string[] }
{
  const reader = createMemoryDirectoryReader(options.tree);
  return {
    filter: {
      id: 'test',
      label: 'Test',
      base: options.base,
      hidePatterns: options.hide ?? [],
      showPatterns: options.show ?? [],
    },
    reader,
    readPaths: reader.readPaths,
    isLeafFolderName: createFolderNameMatcher(options.leafFolders ?? ['node_modules'], false),
    isHiddenByBaseline: createRelativePathMatcher(options.baseline ?? [], false),
    maxEntries: options.maxEntries ?? 10000,
    ignoreCase: false,
    ...(options.cancellation === undefined ? {} : { cancellation: options.cancellation }),
  };
}

describe('computeExclusionPlan in showAll mode', () =>
{
  it('emits hide patterns as globs and reads nothing when there are no show rules', async () =>
  {
    const request = buildRequest({ base: 'showAll', hide: ['**/*.log', 'dist'], tree: ['a.log', 'dist/x.js'] });
    const plan = await computeExclusionPlan(request);
    expect(plan.globEntries).toEqual(['**/*.log', 'dist']);
    expect(plan.concreteEntries).toEqual([]);
    expect(request.readPaths).toEqual([]);
  });

  it('opens only conflict folders and rebases hide globs elsewhere', async () =>
  {
    const request = buildRequest({
      base: 'showAll',
      hide: ['**/*.log'],
      show: ['docs/keep.log'],
      tree: ['a.log', 'src/b.log', 'src/deep/c.log', 'docs/keep.log', 'docs/other.log', 'docs/sub/d.log', 'README.md'],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.concreteEntries).toEqual(['a.log', 'docs/other.log']);
    expect(plan.globEntries).toEqual(['docs/sub/**/*.log', 'src/**/*.log']);
    expect([...request.readPaths].sort()).toEqual(['', 'docs']);
  });

  it('rescues a path inside a hidden folder and collapses siblings', async () =>
  {
    const request = buildRequest({
      base: 'showAll',
      hide: ['docs'],
      show: ['docs/api/**'],
      tree: ['docs/api/a.md', 'docs/guide.md', 'docs/x/y.md', 'src/a.ts'],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.concreteEntries).toEqual(['docs/guide.md', 'docs/x']);
    expect(plan.globEntries).toEqual([]);
  });

  it('hides a folder as a whole when no show rule rescues anything inside', async () =>
  {
    const request = buildRequest({
      base: 'showAll',
      hide: ['docs'],
      show: ['docs/api/**'],
      tree: ['docs/guide.md', 'docs/x/y.md'],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.concreteEntries).toEqual(['docs']);
  });

  it('never opens a leaf folder and applies residual hide globs inside it', async () =>
  {
    const request = buildRequest({
      base: 'showAll',
      hide: ['**/*.log'],
      show: ['**/keep.log'],
      tree: ['node_modules/x.log', 'node_modules/keep.log', 'src/keep.log', 'src/other.log'],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.globEntries).toEqual(['node_modules/**/*.log']);
    expect(plan.concreteEntries).toEqual(['src/other.log']);
    expect(request.readPaths).not.toContain('node_modules');
  });

  it('skips children that the baseline already hides', async () =>
  {
    const request = buildRequest({
      base: 'showAll',
      hide: ['**/*.log'],
      show: ['keep.log'],
      baseline: ['**/.git'],
      tree: ['.git/HEAD', 'a.log', 'keep.log'],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.concreteEntries).toEqual(['a.log']);
    expect(request.readPaths).toEqual(['']);
  });
});

describe('computeExclusionPlan in hideAll mode', () =>
{
  it('shows matched paths, keeps their ancestors, collapses empty folders, and emits hide globs', async () =>
  {
    const request = buildRequest({
      base: 'hideAll',
      show: ['**/CLAUDE.md', '.claude/**'],
      hide: ['**/.claude/cache'],
      tree: [
        'CLAUDE.md',
        '.claude/settings.json',
        '.claude/cache/x',
        'src/CLAUDE.md',
        'src/a.ts',
        'src/lib/b.ts',
        'docs/readme.md',
        'node_modules/pkg/CLAUDE.md',
        'link@',
      ],
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.globEntries).toEqual(['**/.claude/cache']);
    expect(plan.concreteEntries).toEqual(['docs', 'link', 'node_modules', 'src/a.ts', 'src/lib']);
    expect([...request.readPaths].sort()).toEqual(['', 'docs', 'src', 'src/lib']);
  });

  it('reads nothing when a show rule matches the root', async () =>
  {
    const request = buildRequest({ base: 'hideAll', show: ['**'], hide: ['**/*.log'], tree: ['a.log', 'b.ts'] });
    const plan = await computeExclusionPlan(request);
    expect(plan.globEntries).toEqual(['**/*.log']);
    expect(plan.concreteEntries).toEqual([]);
    expect(request.readPaths).toEqual([]);
  });

  it('hides every root child when there are no show rules', async () =>
  {
    const request = buildRequest({ base: 'hideAll', tree: ['a.ts', 'src/b.ts'] });
    const plan = await computeExclusionPlan(request);
    expect(plan.concreteEntries).toEqual(['a.ts', 'src']);
  });

  it('lets a hide rule win over a show rule', async () =>
  {
    const request = buildRequest({ base: 'hideAll', show: ['docs/**'], hide: ['docs'], tree: ['docs/a.md', 'x.ts'] });
    const plan = await computeExclusionPlan(request);
    expect(plan.globEntries).toEqual(['docs']);
    expect(plan.concreteEntries).toEqual(['x.ts']);
  });
});

describe('computeExclusionPlan limits', () =>
{
  it('treats unopened folders as leaf folders when the budget is reached', async () =>
  {
    const request = buildRequest({
      base: 'hideAll',
      show: ['**/CLAUDE.md'],
      tree: ['a/CLAUDE.md', 'b/CLAUDE.md', 'c/CLAUDE.md'],
      maxEntries: 2,
    });
    const plan = await computeExclusionPlan(request);
    expect(plan.isPartial).toBe(true);
    expect(plan.concreteEntries).toEqual(['a', 'b', 'c']);
  });

  it('rejects with WalkCancelledError when the signal is set', async () =>
  {
    const request = buildRequest({
      base: 'hideAll',
      show: ['**/CLAUDE.md'],
      tree: ['a/CLAUDE.md'],
      cancellation: { isCancellationRequested: true },
    });
    await expect(computeExclusionPlan(request)).rejects.toBeInstanceOf(WalkCancelledError);
  });
});
