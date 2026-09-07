import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'test/integration/**/*.test.cjs',
  workspaceFolder: 'test/fixtures/workspace',
  version: 'stable',
  mocha: {
    timeout: 60000,
  },
});
