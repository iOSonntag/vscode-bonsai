import { type DefaultFilter } from './defaultDefinitions.js';

const configurationCategoryIds = [
  'lockfiles',
  'packageManager',
  'compiler',
  'lint',
  'format',
  'test',
  'build',
  'bundler',
  'monorepo',
  'ci',
  'containers',
  'env',
  'versionManagers',
  'git',
  'gitHooks',
  'editor',
  'release',
  'bots',
  'storybook',
];

const documentationCategoryIds = ['docs', 'legal'];

const generatedCategoryIds = ['output', 'cache', 'coverage', 'logs', 'osJunk', 'typings', 'dependencies'];

function toCategoryReferences(categoryIds: readonly string[]): string[]
{
  return categoryIds.map((categoryId) => `category:${categoryId}`);
}

export const codingFilter: DefaultFilter = {
  id: 'coding',
  label: 'Coding',
  base: 'showAll',
  hide: [
    ...toCategoryReferences(configurationCategoryIds),
    ...toCategoryReferences(documentationCategoryIds),
    ...toCategoryReferences(generatedCategoryIds),
    'category:ai',
  ],
  show: [],
};

export const setupFilter: DefaultFilter = {
  id: 'setup',
  label: 'Project setup',
  base: 'hideAll',
  hide: toCategoryReferences(generatedCategoryIds),
  show: [
    'category:manifests',
    ...toCategoryReferences(configurationCategoryIds),
    ...toCategoryReferences(documentationCategoryIds),
    'category:ai',
  ],
};

export const aiFilter: DefaultFilter = {
  id: 'ai',
  label: 'AI',
  base: 'hideAll',
  hide: [],
  show: ['category:ai'],
};

export const defaultFilters: readonly DefaultFilter[] = [codingFilter, setupFilter, aiFilter];

/** The category reference that the `bonsai.coding.hidePackageManifests` switch adds to the Coding filter. */
export const packageManifestsCategoryReference = 'category:manifests';
