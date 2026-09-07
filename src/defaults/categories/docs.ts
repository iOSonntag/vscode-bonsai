import { type DefaultCategory } from '../defaultDefinitions.js';

export const docsCategory: DefaultCategory = {
  id: 'docs',
  label: 'Documentation',
  patterns: [
    'README*',
    '**/README.md',
    'CHANGELOG*',
    'docs',
    'doc',
    'CONTRIBUTING*',
    'CODE_OF_CONDUCT*',
    'SECURITY.md',
    'SUPPORT.md',
    'AUTHORS*',
    'MAINTAINERS*',
    '*.md',
  ],
};
