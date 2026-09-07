import { type DefaultCategory } from '../defaultDefinitions.js';

export const apiSchemaCategory: DefaultCategory = {
  id: 'apiSchema',
  label: 'API schema files',
  patterns: [
    '**/openapi.yaml',
    '**/openapi.json',
    '**/swagger.yaml',
    '**/swagger.json',
    '**/*.proto',
    '**/schema.graphql',
    '**/*.graphql',
    '**/*.thrift',
  ],
};
