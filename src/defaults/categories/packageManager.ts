import { type DefaultCategory } from '../defaultDefinitions.js';

export const packageManagerCategory: DefaultCategory = {
  id: 'packageManager',
  label: 'Package manager config',
  patterns: [
    '**/.npmrc',
    '**/.npmignore',
    '**/.yarnrc',
    '**/.yarnrc.yml',
    '**/.pnpmfile.cjs',
    '**/bunfig.toml',
    '.yarn',
    '.cargo/config.toml',
    '.cargo/config',
    '.bundle/config',
  ],
};
