import { defaultCategories } from './categories/index.js';
import { type DefaultCategory, type DefaultDefinitions } from './defaultDefinitions.js';
import { defaultFilters, packageManifestsCategoryReference } from './filters.js';
import { defaultLeafFolders } from './leafFolders.js';

const compositeCategories: readonly DefaultCategory[] = [
  {
    id: 'config',
    label: 'All configuration',
    patterns: [
      'category:manifests',
      'category:lockfiles',
      'category:packageManager',
      'category:compiler',
      'category:lint',
      'category:format',
      'category:test',
      'category:build',
      'category:bundler',
      'category:monorepo',
      'category:ci',
      'category:containers',
      'category:env',
      'category:versionManagers',
      'category:git',
      'category:gitHooks',
      'category:editor',
      'category:release',
      'category:bots',
      'category:storybook',
    ],
  },
  {
    id: 'generated',
    label: 'Generated files and folders',
    patterns: [
      'category:output',
      'category:cache',
      'category:coverage',
      'category:logs',
      'category:osJunk',
      'category:typings',
      'category:dependencies',
    ],
  },
];

export const defaultDefinitions: DefaultDefinitions = {
  categories: [...defaultCategories, ...compositeCategories],
  filters: defaultFilters,
  leafFolders: defaultLeafFolders,
};

export { packageManifestsCategoryReference };
export { type DefaultDefinitions };
