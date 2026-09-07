import { type DefaultCategory } from '../defaultDefinitions.js';

export const editorCategory: DefaultCategory = {
  id: 'editor',
  label: 'Editor and IDE metadata',
  patterns: [
    '.vscode',
    '.idea',
    '**/*.iml',
    '.vs',
    '.project',
    '.classpath',
    '.settings',
    '.fleet',
    '.zed',
    '*.sublime-project',
    '*.sublime-workspace',
  ],
};
