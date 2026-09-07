import { describe, expect, it } from 'vitest';
import { parseRuleEntry, type RuleEntry } from '../entries/ruleEntry.js';
import { type CategoryDefinition, type FilterCatalog, type FilterDefinition } from './filterCatalog.js';
import { expandCategoryPatterns, resolveFilter } from './resolveFilter.js';

function toEntries(texts: readonly string[]): RuleEntry[]
{
  return texts.map((text) =>
  {
    const result = parseRuleEntry(text);
    if (result.kind === 'invalid')
    {
      throw new Error(result.reason);
    }
    return result.entry;
  });
}

interface FilterInput
{
  readonly label?: string;
  readonly base?: FilterDefinition['base'];
  readonly extends?: string;
  readonly enabled?: boolean;
  readonly hide?: readonly string[];
  readonly show?: readonly string[];
}

function buildCatalog(
  categories: Record<string, readonly string[]>,
  filters: Record<string, FilterInput>,
): FilterCatalog
{
  const categoryMap = new Map<string, CategoryDefinition>();
  for (const [id, patterns] of Object.entries(categories))
  {
    categoryMap.set(id, { id, label: id, entries: toEntries(patterns) });
  }
  const filterMap = new Map<string, FilterDefinition>();
  for (const [id, definition] of Object.entries(filters))
  {
    filterMap.set(id, {
      id,
      label: definition.label ?? id,
      enabled: definition.enabled ?? true,
      hide: toEntries(definition.hide ?? []),
      show: toEntries(definition.show ?? []),
      ...(definition.base === undefined ? {} : { base: definition.base }),
      ...(definition.extends === undefined ? {} : { extends: definition.extends }),
    });
  }
  return { categories: categoryMap, filters: filterMap };
}

describe('resolveFilter', () =>
{
  it('expands nested category references in order and without duplicates', () =>
  {
    const catalog = buildCatalog(
      {
        lint: ['**/eslint.config.*', '**/.eslintrc*'],
        config: ['category:lint', '**/tsconfig*.json', '**/eslint.config.*'],
      },
      { coding: { base: 'showAll', hide: ['category:config', '**/*.log'] } },
    );
    const resolution = resolveFilter(catalog, 'coding');
    expect(resolution.kind).toBe('resolved');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.hidePatterns).toEqual([
        '**/eslint.config.*',
        '**/.eslintrc*',
        '**/tsconfig*.json',
        '**/*.log',
      ]);
      expect(resolution.problems).toEqual([]);
    }
  });

  it('follows the extends chain, inherits the base mode, and merges lists with removals', () =>
  {
    const catalog = buildCatalog(
      { manifests: ['**/package.json'], lint: ['**/eslint.config.*'] },
      {
        coding: { base: 'showAll', hide: ['category:lint', '**/*.log'], show: ['eslint.config.ts'] },
        strict: { extends: 'coding', hide: ['category:manifests', '!**/*.log'], show: ['!eslint.config.ts'] },
      },
    );
    const resolution = resolveFilter(catalog, 'strict');
    expect(resolution.kind).toBe('resolved');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.base).toBe('showAll');
      expect(resolution.filter.hidePatterns).toEqual(['**/eslint.config.*', '**/package.json']);
      expect(resolution.filter.showPatterns).toEqual([]);
    }
  });

  it('removes a pattern that a category contributed when a glob removal names it', () =>
  {
    const catalog = buildCatalog(
      { logs: ['**/*.log', '**/yarn-error.log*'] },
      { coding: { base: 'showAll', hide: ['category:logs', '!**/*.log'] } },
    );
    const resolution = resolveFilter(catalog, 'coding');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.hidePatterns).toEqual(['**/yarn-error.log*']);
    }
    expect(resolution.kind).toBe('resolved');
  });

  it('removes the patterns of a category when a category removal follows a wider reference', () =>
  {
    const catalog = buildCatalog(
      { manifests: ['**/package.json'], lint: ['**/eslint.config.*'], config: ['category:manifests', 'category:lint'] },
      { coding: { base: 'showAll', hide: ['category:config', '!category:manifests'] } },
    );
    const resolution = resolveFilter(catalog, 'coding');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.hidePatterns).toEqual(['**/eslint.config.*']);
    }
    expect(resolution.kind).toBe('resolved');
  });

  it('reports an unknown category and continues', () =>
  {
    const catalog = buildCatalog({}, { ai: { base: 'hideAll', show: ['category:ai', 'CLAUDE.md'] } });
    const resolution = resolveFilter(catalog, 'ai');
    expect(resolution.kind).toBe('resolved');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.showPatterns).toEqual(['CLAUDE.md']);
      expect(resolution.problems.map((problem) => problem.code)).toEqual(['unknownCategory']);
    }
  });

  it('reports a category cycle once and keeps the other patterns', () =>
  {
    const catalog = buildCatalog(
      { first: ['category:second', 'a'], second: ['category:first', 'b'] },
      { ai: { base: 'hideAll', show: ['category:first'] } },
    );
    const resolution = resolveFilter(catalog, 'ai');
    if (resolution.kind === 'resolved')
    {
      expect(resolution.filter.showPatterns).toEqual(['b', 'a']);
      expect(resolution.problems.map((problem) => problem.code)).toEqual(['categoryCycle']);
    }
    expect(resolution.kind).toBe('resolved');
  });

  it('fails on a filter cycle, an unknown parent, and a missing base mode', () =>
  {
    const catalog = buildCatalog(
      {},
      {
        first: { extends: 'second' },
        second: { extends: 'first' },
        orphan: { extends: 'missing' },
        noBase: { hide: ['x'] },
      },
    );
    expect(resolveFilter(catalog, 'first')).toMatchObject({ kind: 'failed', problems: [{ code: 'filterCycle' }] });
    expect(resolveFilter(catalog, 'orphan')).toMatchObject({ kind: 'failed', problems: [{ code: 'unknownParentFilter' }] });
    expect(resolveFilter(catalog, 'noBase')).toMatchObject({ kind: 'failed', problems: [{ code: 'missingBaseMode' }] });
  });
});

describe('expandCategoryPatterns', () =>
{
  it('expands one category with nested references', () =>
  {
    const catalog = buildCatalog({ lint: ['a'], config: ['category:lint', 'b'] }, {});
    expect(expandCategoryPatterns(catalog, 'config')).toEqual(['a', 'b']);
  });
});
