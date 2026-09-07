import { type DefaultCategory } from '../defaultDefinitions.js';

export const formatCategory: DefaultCategory = {
  id: 'format',
  label: 'Format config',
  patterns: [
    '**/.prettierrc*',
    '**/prettier.config.*',
    '**/.prettierignore',
    'rustfmt.toml',
    '.clang-format',
    '.swift-format',
    '**/.editorconfig',
  ],
};
