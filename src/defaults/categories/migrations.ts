import { type DefaultCategory } from '../defaultDefinitions.js';

export const migrationsCategory: DefaultCategory = {
  id: 'migrations',
  label: 'Database migration tooling',
  patterns: [
    'knexfile.js',
    'drizzle.config.ts',
    'prisma/schema.prisma',
    'alembic.ini',
    'alembic/versions',
    'db/migrate',
    'db/schema.rb',
    '**/migrations',
  ],
};
