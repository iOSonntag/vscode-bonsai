import { type DefaultCategory } from '../defaultDefinitions.js';

export const envCategory: DefaultCategory = {
  id: 'env',
  label: 'Environment files',
  patterns: [
    '**/.env',
    '**/.env.local',
    '**/.env.*.local',
    '**/.env.example',
    '**/.env.sample',
    '**/.env.template',
    '**/.flaskenv',
  ],
};
