import { type DefaultCategory } from '../defaultDefinitions.js';

export const storybookCategory: DefaultCategory = {
  id: 'storybook',
  label: 'Storybook and design tooling',
  patterns: [
    '.storybook',
    '.chromatic',
  ],
};
