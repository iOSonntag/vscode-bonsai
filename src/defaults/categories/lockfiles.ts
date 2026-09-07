import { type DefaultCategory } from '../defaultDefinitions.js';

export const lockfilesCategory: DefaultCategory = {
  id: 'lockfiles',
  label: 'Lockfiles',
  patterns: [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lock',
    'bun.lockb',
    'deno.lock',
    'poetry.lock',
    'uv.lock',
    'Pipfile.lock',
    'conda-lock.yml',
    'Cargo.lock',
    'go.sum',
    'pubspec.lock',
    'Gemfile.lock',
    'composer.lock',
    'packages.lock.json',
    'mix.lock',
    '**/Package.resolved',
    'Podfile.lock',
    '.terraform.lock.hcl',
  ],
};
