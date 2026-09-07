import { type DefaultCategory } from '../defaultDefinitions.js';

export const typingsCategory: DefaultCategory = {
  id: 'typings',
  label: 'Type declaration output',
  patterns: [
    '**/dist/**/*.d.ts',
    '**/build/**/*.d.ts',
    '**/lib/**/*.d.ts',
  ],
};
