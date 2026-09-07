import { type DefaultCategory } from '../defaultDefinitions.js';

export const outputCategory: DefaultCategory = {
  id: 'output',
  label: 'Build output folders',
  patterns: [
    '**/dist',
    '**/build',
    '**/out',
    '**/.next',
    '**/.nuxt',
    '**/.output',
    '**/storybook-static',
    '**/target',
    '**/_build',
    '**/DerivedData',
    'bazel-*',
  ],
};
