import { type DefaultCategory } from '../defaultDefinitions.js';

export const botsCategory: DefaultCategory = {
  id: 'bots',
  label: 'Dependency bot config',
  patterns: [
    '.github/dependabot.yml',
    'renovate.json',
    'renovate.json5',
    '.renovaterc',
    '.renovaterc.json',
  ],
};
