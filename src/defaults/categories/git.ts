import { type DefaultCategory } from '../defaultDefinitions.js';

export const gitCategory: DefaultCategory = {
  id: 'git',
  label: 'Git metadata',
  patterns: [
    '.git',
    '**/.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.mailmap',
    '**/.gitkeep',
  ],
};
