import { type DefaultCategory } from '../defaultDefinitions.js';

export const osJunkCategory: DefaultCategory = {
  id: 'osJunk',
  label: 'OS junk files',
  patterns: [
    '**/.DS_Store',
    '**/._*',
    '**/Thumbs.db',
    '**/desktop.ini',
    '**/.Spotlight-V100',
    '**/.Trashes',
  ],
};
