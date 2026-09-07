import { describe, expect, it } from 'vitest';
import { type DefaultDefinitions } from '../defaults/defaultDefinitions.js';
import { formatRuleEntry } from '../rules/entries/ruleEntry.js';
import { type ConfigurationLayer } from './configurationLayer.js';
import { mergeCatalogLayers } from './catalogMerge.js';

const defaults: DefaultDefinitions =
  {
    categories: [
      { id: 'manifests', label: 'Package manifests', patterns: ['**/package.json'] },
      { id: 'lint', label: 'Lint config', patterns: ['**/eslint.config.*'] },
    ],
    filters: [
      { id: 'coding', label: 'Coding', base: 'showAll', hide: ['category:lint', '**/*.log'], show: [] },
    ],
    leafFolders: ['node_modules', 'dist'],
  };

function buildLayer(scope: ConfigurationLayer['scope'], overrides: Partial<ConfigurationLayer>): ConfigurationLayer
{
  return { scope, categories: {}, filters: {}, leafFolders: [], ...overrides };
}

describe('mergeCatalogLayers', () =>
{
  it('starts from the defaults', () =>
  {
    const result = mergeCatalogLayers(defaults, [], { hidePackageManifests: false });
    expect([...result.catalog.filters.keys()]).toEqual(['coding']);
    expect(result.catalog.filters.get('coding')?.hide.map(formatRuleEntry)).toEqual(['category:lint', '**/*.log']);
    expect(result.leafFolders).toEqual(['node_modules', 'dist']);
    expect(result.problems).toEqual([]);
  });

  it('adds the manifests category to coding when the switch is on', () =>
  {
    const result = mergeCatalogLayers(defaults, [], { hidePackageManifests: true });
    expect(result.catalog.filters.get('coding')?.hide.map(formatRuleEntry)).toContain('category:manifests');
  });

  it('adds lists across layers, applies removals, and lets the last layer set scalars', () =>
  {
    const userLayer = buildLayer('user', {
      filters: { coding: { hide: ['**/*.tmp'], label: 'My coding' } },
      categories: { lint: { patterns: ['**/biome.json*'] } },
      leafFolders: ['!dist', 'target'],
    });
    const workspaceLayer = buildLayer('workspace', {
      filters: { coding: { hide: ['!**/*.log'], enabled: false }, custom: { extends: 'coding', show: ['README.md'] } },
      categories: { extra: { label: 'Extra', patterns: ['category:lint'] } },
    });
    const result = mergeCatalogLayers(defaults, [userLayer, workspaceLayer], { hidePackageManifests: false });
    const coding = result.catalog.filters.get('coding');
    expect(coding?.label).toBe('My coding');
    expect(coding?.enabled).toBe(false);
    expect(coding?.hide.map(formatRuleEntry)).toEqual(['category:lint', '**/*.tmp', '!**/*.log']);
    expect(result.catalog.filters.get('custom')).toMatchObject({ extends: 'coding', enabled: true });
    expect(result.catalog.categories.get('lint')?.entries.map(formatRuleEntry)).toEqual([
      '**/eslint.config.*',
      '**/biome.json*',
    ]);
    expect(result.catalog.categories.get('extra')?.label).toBe('Extra');
    expect(result.leafFolders).toEqual(['node_modules', 'target']);
    expect(result.problems).toEqual([]);
  });

  it('reports invalid entries with their scope and path and keeps the rest', () =>
  {
    const layer = buildLayer('workspaceFolder', {
      filters: { coding: { hide: ['', 'ok'] } },
      leafFolders: ['category:lint', 'fine'],
    });
    const result = mergeCatalogLayers(defaults, [layer], { hidePackageManifests: false });
    expect(result.problems).toEqual([
      { scope: 'workspaceFolder', path: 'bonsai.filters.coding.hide[0]', message: 'An entry cannot be empty.' },
      {
        scope: 'workspaceFolder',
        path: 'bonsai.leafFolders[0]',
        message: 'A leaf folder entry cannot reference a category.',
      },
    ]);
    expect(result.catalog.filters.get('coding')?.hide.map(formatRuleEntry)).toContain('ok');
    expect(result.leafFolders).toContain('fine');
  });
});
