import { type DefaultCategory } from '../defaultDefinitions.js';

export const dependenciesCategory: DefaultCategory = {
  id: 'dependencies',
  label: 'Dependency folders',
  patterns: [
    '**/node_modules',
    '.pnp.cjs',
    '.pnp.loader.mjs',
    '**/.yarn/cache',
    '**/.venv',
    '**/venv',
    '**/env',
    '**/__pypackages__',
    '**/vendor',
    '**/target',
    '**/.dart_tool',
    '**/.bundle',
    '**/Pods',
    '**/.build',
    '**/deps',
    '**/.gradle',
  ],
};
