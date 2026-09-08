import { type DefaultCategory } from '../defaultDefinitions.js';

export const containersCategory: DefaultCategory = {
  id: 'containers',
  label: 'Container and dev environment config',
  patterns: [
    '**/Dockerfile*',
    '**/.dockerignore',
    '**/docker-compose.yml',
    '**/docker-compose.*.yml',
    '**/docker-compose.yaml',
    '**/docker-compose.*.yaml',
    '**/compose.yml',
    '**/compose.yaml',
    '**/compose.*.yml',
    '**/compose.*.yaml',
    '.devcontainer',
    'Vagrantfile',
    'Procfile',
  ],
};
