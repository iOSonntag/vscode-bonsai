import { type DefaultCategory } from '../defaultDefinitions.js';

export const releaseCategory: DefaultCategory = {
  id: 'release',
  label: 'Release and changelog tooling',
  patterns: [
    '.changeset',
    '.release-please-manifest.json',
    'release-please-config.json',
    '.releaserc*',
    '.versionrc',
    '.versionrc.json',
    'CHANGELOG.lock',
  ],
};
