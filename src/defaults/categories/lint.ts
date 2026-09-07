import { type DefaultCategory } from '../defaultDefinitions.js';

export const lintCategory: DefaultCategory = {
  id: 'lint',
  label: 'Lint config',
  patterns: [
    '**/.eslintrc*',
    '**/eslint.config.*',
    '**/.eslintignore',
    '**/.stylelintrc*',
    '.flake8',
    'ruff.toml',
    '.ruff.toml',
    '.pylintrc',
    'clippy.toml',
    '.golangci.yml',
    '.golangci.yaml',
    '.rubocop.yml',
    'phpcs.xml',
    'phpcs.xml.dist',
    'checkstyle.xml',
    '.credo.exs',
    '.swiftlint.yml',
    '.clang-tidy',
    '.htmlhintrc',
  ],
};
