import { type DefaultCategory } from '../defaultDefinitions.js';

export const legalCategory: DefaultCategory = {
  id: 'legal',
  label: 'Legal files',
  patterns: [
    'LICENSE*',
    'LICENCE*',
    '**/LICENSE*',
    'COPYING*',
    'NOTICE*',
    'PATENTS*',
  ],
};
