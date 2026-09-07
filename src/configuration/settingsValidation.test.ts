import { describe, expect, it } from 'vitest';
import { validateConfigurationLayer } from './settingsValidation.js';

describe('validateConfigurationLayer', () =>
{
  it('accepts valid definitions and empty scopes', () =>
  {
    const result = validateConfigurationLayer('user', {
      categories: { lint: { label: 'Lint', patterns: ['**/eslint.config.*'] } },
      filters: { coding: { base: 'showAll', hide: ['category:lint'], enabled: true } },
      leafFolders: ['node_modules'],
    });
    expect(result.problems).toEqual([]);
    expect(result.layer.categories['lint']?.patterns).toEqual(['**/eslint.config.*']);
    expect(result.layer.filters['coding']?.base).toBe('showAll');
    expect(result.layer.leafFolders).toEqual(['node_modules']);
    expect(validateConfigurationLayer('workspace', { categories: undefined, filters: undefined, leafFolders: undefined }))
      .toEqual({ layer: { scope: 'workspace', categories: {}, filters: {}, leafFolders: [] }, problems: [] });
  });

  it('keeps valid definitions next to invalid ones and reports each problem with a path', () =>
  {
    const result = validateConfigurationLayer('workspace', {
      categories: { good: { patterns: ['a'] }, 'bad id': { patterns: ['b'] } },
      filters: { coding: { base: 'sideways', hide: 'not-a-list' }, ok: { show: ['x'] } },
      leafFolders: 'dist',
    });
    expect(Object.keys(result.layer.categories)).toEqual(['good']);
    expect(Object.keys(result.layer.filters)).toEqual(['ok']);
    expect(result.layer.leafFolders).toEqual([]);
    expect(result.problems.map((problem) => problem.path)).toEqual([
      'bonsai.categories.bad id',
      'bonsai.filters.coding.base',
      'bonsai.filters.coding.hide',
      'bonsai.leafFolders',
    ]);
  });

  it('rejects unknown fields so that a typo does not pass silently', () =>
  {
    const result = validateConfigurationLayer('user', {
      categories: {},
      filters: { coding: { hidden: ['x'] } },
      leafFolders: [],
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.path).toBe('bonsai.filters.coding.');
  });
});
