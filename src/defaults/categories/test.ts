import { type DefaultCategory } from '../defaultDefinitions.js';

export const testCategory: DefaultCategory = {
  id: 'test',
  label: 'Test config',
  patterns: [
    '**/jest.config.*',
    '**/vitest.config.*',
    '**/karma.conf.js',
    '**/cypress.config.*',
    '**/playwright.config.*',
    'pytest.ini',
    'tox.ini',
    '.rspec',
    'phpunit.xml',
    'phpunit.xml.dist',
    '**/*.testsettings',
  ],
};
