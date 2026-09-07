import { type DefaultCategory } from '../defaultDefinitions.js';

export const monorepoCategory: DefaultCategory = {
  id: 'monorepo',
  label: 'Monorepo tool config',
  patterns: [
    'nx.json',
    '**/project.json',
    'turbo.json',
    'lerna.json',
    'rush.json',
    'pnpm-workspace.yaml',
    'workspace.json',
    'melos.yaml',
  ],
};
