import { type DefaultDefinitions } from '../defaults/defaultDefinitions.js';
import { packageManifestsCategoryReference } from '../defaults/filters.js';
import {
  type CategoryDefinition,
  type FilterCatalog,
  type FilterDefinition,
} from '../rules/catalog/filterCatalog.js';
import { mergeRuleEntryLists, parseRuleEntry, type RuleEntry } from '../rules/entries/ruleEntry.js';
import { type ConfigurationLayer, type ConfigurationProblem, type ConfigurationScopeName } from './configurationLayer.js';

export interface CatalogMergeOptions
{
  readonly hidePackageManifests: boolean;
}

export interface CatalogMergeResult
{
  readonly catalog: FilterCatalog;
  readonly leafFolders: readonly string[];
  readonly problems: readonly ConfigurationProblem[];
}

/**
 * Merges the shipped defaults with the configuration layers in order. Pattern lists add up,
 * and a `!` removal drops an inherited entry. Scalar fields take the last layer that sets them.
 */
export function mergeCatalogLayers(
  defaults: DefaultDefinitions,
  layers: readonly ConfigurationLayer[],
  options: CatalogMergeOptions,
): CatalogMergeResult
{
  const problems: ConfigurationProblem[] = [];
  const categories = new Map<string, CategoryDefinition>();
  const filters = new Map<string, FilterDefinition>();

  for (const category of defaults.categories)
  {
    categories.set(category.id, {
      id: category.id,
      label: category.label,
      entries: parseEntryList(category.patterns, 'defaults', `bonsai.categories.${category.id}.patterns`, problems),
    });
  }
  for (const filter of defaults.filters)
  {
    const hideTexts = filter.id === 'coding' && options.hidePackageManifests
      ? [...filter.hide, packageManifestsCategoryReference]
      : filter.hide;
    filters.set(filter.id, {
      id: filter.id,
      label: filter.label,
      base: filter.base,
      enabled: true,
      hide: parseEntryList(hideTexts, 'defaults', `bonsai.filters.${filter.id}.hide`, problems),
      show: parseEntryList(filter.show, 'defaults', `bonsai.filters.${filter.id}.show`, problems),
    });
  }
  let leafFolderEntries = parseGlobOnlyList(defaults.leafFolders, 'defaults', 'bonsai.leafFolders', problems);

  for (const layer of layers)
  {
    for (const [categoryId, rawCategory] of Object.entries(layer.categories))
    {
      const existing = categories.get(categoryId);
      const additions = parseEntryList(
        rawCategory.patterns ?? [],
        layer.scope,
        `bonsai.categories.${categoryId}.patterns`,
        problems,
      );
      categories.set(categoryId, {
        id: categoryId,
        label: rawCategory.label ?? existing?.label ?? categoryId,
        entries: mergeRuleEntryLists(existing?.entries ?? [], additions),
      });
    }
    for (const [filterId, rawFilter] of Object.entries(layer.filters))
    {
      const existing = filters.get(filterId);
      const hideAdditions = parseEntryList(rawFilter.hide ?? [], layer.scope, `bonsai.filters.${filterId}.hide`, problems);
      const showAdditions = parseEntryList(rawFilter.show ?? [], layer.scope, `bonsai.filters.${filterId}.show`, problems);
      const base = rawFilter.base ?? existing?.base;
      const parentId = rawFilter.extends ?? existing?.extends;
      filters.set(filterId, {
        id: filterId,
        label: rawFilter.label ?? existing?.label ?? filterId,
        enabled: rawFilter.enabled ?? existing?.enabled ?? true,
        hide: mergeRuleEntryLists(existing?.hide ?? [], hideAdditions),
        show: mergeRuleEntryLists(existing?.show ?? [], showAdditions),
        ...(base === undefined ? {} : { base }),
        ...(parentId === undefined ? {} : { extends: parentId }),
      });
    }
    leafFolderEntries = mergeRuleEntryLists(
      leafFolderEntries,
      parseGlobOnlyList(layer.leafFolders, layer.scope, 'bonsai.leafFolders', problems),
    );
  }

  const leafFolders = leafFolderEntries.flatMap((entry) => (entry.kind === 'glob' ? [entry.pattern] : []));
  return { catalog: { categories, filters }, leafFolders, problems };
}

function parseEntryList(
  texts: readonly string[],
  scope: ConfigurationScopeName,
  path: string,
  problems: ConfigurationProblem[],
): RuleEntry[]
{
  const entries: RuleEntry[] = [];
  for (const [index, text] of texts.entries())
  {
    const result = parseRuleEntry(text);
    if (result.kind === 'invalid')
    {
      problems.push({ scope, path: `${path}[${index}]`, message: result.reason });
      continue;
    }
    entries.push(result.entry);
  }
  return entries;
}

function parseGlobOnlyList(
  texts: readonly string[],
  scope: ConfigurationScopeName,
  path: string,
  problems: ConfigurationProblem[],
): RuleEntry[]
{
  const entries = parseEntryList(texts, scope, path, problems);
  return entries.filter((entry, index) =>
  {
    const isCategoryReference = entry.kind === 'categoryReference'
      || (entry.kind === 'removal' && entry.target.kind === 'categoryReference');
    if (isCategoryReference)
    {
      problems.push({ scope, path: `${path}[${index}]`, message: 'A leaf folder entry cannot reference a category.' });
      return false;
    }
    return true;
  });
}
