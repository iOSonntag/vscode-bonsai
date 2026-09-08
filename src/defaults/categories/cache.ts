import { type DefaultCategory } from '../defaultDefinitions.js';

export const cacheCategory: DefaultCategory = {
  id: 'cache',
  label: 'Cache folders',
  patterns: [
    '**/.cache',
    '**/.parcel-cache',
    '**/.turbo',
    '**/.nx/cache',
    '**/.eslintcache',
    '**/__pycache__',
    '**/.mypy_cache',
    '**/.ruff_cache',
    '**/.pytest_cache',
    '**/.gradle',
    '**/.dart_tool',
    '**/.terraform',
    '**/.sst',
    'bootstrap/cache',
    'storage/framework',
    '**/.phpunit.cache',
    '**/.phpunit.result.cache',
  ],
};
