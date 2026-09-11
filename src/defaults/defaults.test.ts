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

  it('hide test code only in the Coding excluding tests filter', () =>
  {
    const coding = resolveFilter(merge.catalog, 'coding');
    const withoutTests = resolveFilter(merge.catalog, 'codingWithoutTests');
    expect(coding.kind).toBe('resolved');
    expect(withoutTests.kind).toBe('resolved');
    if (coding.kind !== 'resolved' || withoutTests.kind !== 'resolved')
    {
      return;
    }
    expect(withoutTests.filter.base).toBe('showAll');
    expect(withoutTests.filter.label).toBe('Coding excluding tests');
    for (const pattern of coding.filter.hidePatterns)
    {
      expect(withoutTests.filter.hidePatterns).toContain(pattern);
    }
    for (const pattern of ['**/__tests__', '**/test', '**/*.test.*', '**/*.spec.*', '**/*_test.go'])
    {
      expect(coding.filter.hidePatterns).not.toContain(pattern);
      expect(withoutTests.filter.hidePatterns).toContain(pattern);
    }
    expect(coding.filter.hidePatterns).toContain('**/.sst');
    expect(defaultDefinitions.filters.map((filter) => filter.id)).toEqual(['coding', 'codingWithoutTests', 'setup', 'ai']);
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
    const expectedPatterns = [
      '.ai',
      '**/.oxlintrc.json',
      '**/commitlint.config.*',
      '**/dprint.json',
      '**/knip.json',
      '**/.env.*',
      '**/.vitest',
      '.trivyignore.yaml',
      'components.json',
      '**/compose.*.yaml',
      '**/phpstan.neon',
      '**/pint.json',
      'boost.json',
      'artisan',
      'storage/framework',
      '**/CONTEXT.md',
    ];
    for (const expected of expectedPatterns)
    {
      expect(hidePatterns, expected).toContain(expected);
    }
  });
});
