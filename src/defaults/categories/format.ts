import { type DefaultCategory } from '../defaultDefinitions.js';

export const formatCategory: DefaultCategory = {
  id: 'format',
  label: 'Format config',
  patterns: [
    '**/.prettierrc*',
    '**/prettier.config.*',
    '**/.prettierignore',
    '**/pint.json',
    '**/dprint.json',
    '**/dprint.jsonc',
    '**/.dprint.json',
    '**/.dprint.jsonc',
    'rustfmt.toml',
    '.clang-format',
    '.swift-format',
    '**/.editorconfig',
  ],
};
