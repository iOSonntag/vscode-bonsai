import { type DefaultCategory } from '../defaultDefinitions.js';

export const gitHooksCategory: DefaultCategory = {
  id: 'gitHooks',
  label: 'Git hook tools',
  patterns: [
    '.husky',
    '.pre-commit-config.yaml',
    'lefthook.yml',
    '.lintstagedrc*',
    '.overcommit.yml',
  ],
};
