import { type DefaultCategory } from '../defaultDefinitions.js';

export const gitHooksCategory: DefaultCategory = {
  id: 'gitHooks',
  label: 'Git hook tools',
  patterns: [
    '.husky',
    '.pre-commit-config.yaml',
    'lefthook.yml',
    '.lintstagedrc*',
    'lefthook.yaml',
    '.lefthook.yml',
    '.lefthook.yaml',
    'lefthook-local.yml',
    '**/lint-staged.config.*',
    '**/commitlint.config.*',
    '.commitlintrc*',
    '.simple-git-hooks*',
    'simple-git-hooks.*',
    '.overcommit.yml',
  ],
};
