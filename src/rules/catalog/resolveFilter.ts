import { mergeRuleEntryLists, type RuleEntry } from '../entries/ruleEntry.js';
import {
  type CatalogProblem,
  type FilterBaseMode,
  type FilterCatalog,
  type FilterDefinition,
  type ResolvedFilter,
} from './filterCatalog.js';

export type FilterResolution =
  | { readonly kind: 'resolved'; readonly filter: ResolvedFilter; readonly problems: readonly CatalogProblem[] }
  | { readonly kind: 'failed'; readonly problems: readonly CatalogProblem[] };

/**
 * Expands a filter into plain patterns: it follows the `extends` chain, merges the lists,
 * and replaces every category reference with the category's patterns. A removal drops the
 * patterns of its target from everything expanded before it, wherever they came from.
 * A cycle or an unknown reference is reported as a problem; an unknown reference is skipped.
 */
export function resolveFilter(catalog: FilterCatalog, filterId: string): FilterResolution
{
  const problems: CatalogProblem[] = [];
  const chain = collectExtendsChain(catalog, filterId, problems);
  if (chain === undefined)
  {
    return { kind: 'failed', problems };
  }
  const baseMode = findBaseMode(chain);
  if (baseMode === undefined)
  {
    problems.push({
      code: 'missingBaseMode',
      filterId,
      message: `Filter "${filterId}" has no base mode, and no parent filter defines one.`,
    });
    return { kind: 'failed', problems };
  }
  let hideEntries: RuleEntry[] = [];
  let showEntries: RuleEntry[] = [];
  for (const definition of chain)
  {
    hideEntries = mergeRuleEntryLists(hideEntries, definition.hide);
    showEntries = mergeRuleEntryLists(showEntries, definition.show);
  }
  const ownDefinition = chain.at(-1);
  const label = ownDefinition?.label ?? filterId;
  return {
    kind: 'resolved',
    filter: {
      id: filterId,
      label,
      base: baseMode,
      hidePatterns: expandEntriesToPatterns(catalog, hideEntries, filterId, problems),
      showPatterns: expandEntriesToPatterns(catalog, showEntries, filterId, problems),
    },
    problems,
  };
}

/** Expands the entries of one category to plain patterns, following nested references. */
export function expandCategoryPatterns(catalog: FilterCatalog, categoryId: string): readonly string[]
{
  return expandEntriesToPatterns(catalog, [{ kind: 'categoryReference', categoryId }], categoryId, []);
}

function collectExtendsChain(
  catalog: FilterCatalog,
  filterId: string,
  problems: CatalogProblem[],
): FilterDefinition[] | undefined
{
  const chain: FilterDefinition[] = [];
  const visitedIds = new Set<string>();
  let currentId: string | undefined = filterId;
  while (currentId !== undefined)
  {
    if (visitedIds.has(currentId))
    {
      problems.push({
        code: 'filterCycle',
        filterId,
        message: `Filter "${filterId}" extends itself through "${currentId}".`,
      });
      return undefined;
    }
    visitedIds.add(currentId);
    const definition = catalog.filters.get(currentId);
    if (definition === undefined)
    {
      problems.push({
        code: 'unknownParentFilter',
        filterId,
        message: `Filter "${filterId}" refers to the unknown filter "${currentId}".`,
      });
      return undefined;
    }
    chain.unshift(definition);
    currentId = definition.extends;
  }
  return chain;
}

function findBaseMode(chain: readonly FilterDefinition[]): FilterBaseMode | undefined
{
  for (let index = chain.length - 1; index >= 0; index -= 1)
  {
    const baseMode = chain[index]?.base;
    if (baseMode !== undefined)
    {
      return baseMode;
    }
  }
  return undefined;
}

function expandEntriesToPatterns(
  catalog: FilterCatalog,
  entries: readonly RuleEntry[],
  filterId: string,
  problems: CatalogProblem[],
): string[]
{
  let patterns: string[] = [];
  const appendPattern = (pattern: string): void =>
  {
    if (!patterns.includes(pattern))
    {
      patterns.push(pattern);
    }
  };
  const expandEntry = (entry: RuleEntry, activeCategoryIds: readonly string[]): void =>
  {
    if (entry.kind === 'removal')
    {
      const removedPatterns = new Set(
        entry.target.kind === 'glob'
          ? [entry.target.pattern]
          : expandEntriesToPatterns(catalog, [entry.target], filterId, problems),
      );
      patterns = patterns.filter((pattern) => !removedPatterns.has(pattern));
      return;
    }
    if (entry.kind === 'glob')
    {
      appendPattern(entry.pattern);
      return;
    }
    if (activeCategoryIds.includes(entry.categoryId))
    {
      problems.push({
        code: 'categoryCycle',
        filterId,
        message: `Category "${entry.categoryId}" refers to itself through ${activeCategoryIds.join(' > ')}.`,
      });
      return;
    }
    const category = catalog.categories.get(entry.categoryId);
    if (category === undefined)
    {
      problems.push({
        code: 'unknownCategory',
        filterId,
        message: `"${filterId}" refers to the unknown category "${entry.categoryId}".`,
      });
      return;
    }
    for (const categoryEntry of category.entries)
    {
      expandEntry(categoryEntry, [...activeCategoryIds, entry.categoryId]);
    }
  };
  for (const entry of entries)
  {
    expandEntry(entry, []);
  }
  return patterns;
}
