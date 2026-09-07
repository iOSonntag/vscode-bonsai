import { describe, expect, it } from 'vitest';
import { mergeCatalogLayers } from '../configuration/catalogMerge.js';
import { resolveFilter } from '../rules/catalog/resolveFilter.js';
import { compileGlobPattern } from '../rules/glob/globPattern.js';
import { defaultDefinitions } from './index.js';

describe('the shipped defaults', () =>
{
  const merge = mergeCatalogLayers(defaultDefinitions, [], { hidePackageManifests: true });

  it('parse without a problem', () =>
  {
    expect(merge.problems).toEqual([]);
  });

  it('resolve every filter without a problem', () =>
  {
    for (const filter of defaultDefinitions.filters)
    {
      const resolution = resolveFilter(merge.catalog, filter.id);
      expect(resolution.kind, filter.id).toBe('resolved');
      expect(resolution.problems, filter.id).toEqual([]);
    }
  });

  it('reference only categories that exist', () =>
  {
    const categoryIds = new Set(defaultDefinitions.categories.map((category) => category.id));
    const referencedIds = new Set<string>();
    const collectReferences = (patterns: readonly string[]): void =>
    {
      for (const pattern of patterns)
      {
        if (pattern.startsWith('category:'))
        {
          referencedIds.add(pattern.slice('category:'.length));
        }
      }
    };
    for (const category of defaultDefinitions.categories)
    {
      collectReferences(category.patterns);
    }
    for (const filter of defaultDefinitions.filters)
    {
      collectReferences(filter.hide);
      collectReferences(filter.show);
    }
    for (const referencedId of referencedIds)
    {
      expect(categoryIds.has(referencedId), referencedId).toBe(true);
    }
  });

  it('hold only patterns that compile to at least one glob', () =>
  {
    for (const category of defaultDefinitions.categories)
    {
      for (const pattern of category.patterns)
      {
        if (pattern.startsWith('category:'))
        {
          continue;
        }
        expect(compileGlobPattern(pattern, { ignoreCase: false }).length, `${category.id}: ${pattern}`).toBeGreaterThan(0);
      }
    }
    for (const leafFolder of defaultDefinitions.leafFolders)
    {
      expect(compileGlobPattern(leafFolder, { ignoreCase: false }), leafFolder).toHaveLength(1);
    }
  });

  it('hide the items from the field report in the Coding filter', () =>
  {
    const resolution = resolveFilter(merge.catalog, 'coding');
    expect(resolution.kind).toBe('resolved');
    if (resolution.kind !== 'resolved')
    {
      return;
    }
    const hidePatterns = resolution.filter.hidePatterns;
    for (const expected of ['.ai', '**/.oxlintrc.json', '**/commitlint.config.*', '**/dprint.json', '**/knip.json'])
    {
      expect(hidePatterns, expected).toContain(expected);
    }
  });
});
