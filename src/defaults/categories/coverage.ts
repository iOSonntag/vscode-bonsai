import { type DefaultCategory } from '../defaultDefinitions.js';

export const coverageCategory: DefaultCategory = {
  id: 'coverage',
  label: 'Coverage and report folders',
  patterns: [
    '**/coverage',
    '**/.nyc_output',
    '**/htmlcov',
    '**/lcov.info',
    '**/test-results',
    '**/playwright-report',
    '**/.qodana',
  ],
};
