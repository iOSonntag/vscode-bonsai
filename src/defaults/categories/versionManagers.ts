import { type DefaultCategory } from '../defaultDefinitions.js';

export const versionManagersCategory: DefaultCategory = {
  id: 'versionManagers',
  label: 'Version manager files',
  patterns: [
    '.nvmrc',
    '.node-version',
    '.python-version',
    '.ruby-version',
    '.tool-versions',
    '.mise.toml',
    'mise.toml',
    '.java-version',
    '.terraform-version',
  ],
};
