import { type DefaultCategory } from '../defaultDefinitions.js';

export const logsCategory: DefaultCategory = {
  id: 'logs',
  label: 'Log files',
  patterns: [
    'logs',
    'log',
    '**/*.log',
    '**/npm-debug.log*',
    '**/yarn-error.log',
    '**/yarn-debug.log*',
    '**/lerna-debug.log*',
    '**/pnpm-debug.log*',
  ],
};
