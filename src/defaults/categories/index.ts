import { type DefaultCategory } from '../defaultDefinitions.js';
import { manifestsCategory } from './manifests.js';
import { lockfilesCategory } from './lockfiles.js';
import { dependenciesCategory } from './dependencies.js';
import { compilerCategory } from './compiler.js';
import { lintCategory } from './lint.js';
import { formatCategory } from './format.js';
import { testCategory } from './test.js';
import { buildCategory } from './build.js';
import { bundlerCategory } from './bundler.js';
import { monorepoCategory } from './monorepo.js';
import { ciCategory } from './ci.js';
import { containersCategory } from './containers.js';
import { envCategory } from './env.js';
import { versionManagersCategory } from './versionManagers.js';
import { gitCategory } from './git.js';
import { gitHooksCategory } from './gitHooks.js';
import { editorCategory } from './editor.js';
import { docsCategory } from './docs.js';
import { legalCategory } from './legal.js';
import { releaseCategory } from './release.js';
import { botsCategory } from './bots.js';
import { outputCategory } from './output.js';
import { cacheCategory } from './cache.js';
import { coverageCategory } from './coverage.js';
import { logsCategory } from './logs.js';
import { osJunkCategory } from './osJunk.js';
import { typingsCategory } from './typings.js';
import { storybookCategory } from './storybook.js';
import { migrationsCategory } from './migrations.js';
import { apiSchemaCategory } from './apiSchema.js';
import { aiCategory } from './ai.js';

export const defaultCategories: readonly DefaultCategory[] = [
  manifestsCategory,
  lockfilesCategory,
  dependenciesCategory,
  compilerCategory,
  lintCategory,
  formatCategory,
  testCategory,
  buildCategory,
  bundlerCategory,
  monorepoCategory,
  ciCategory,
  containersCategory,
  envCategory,
  versionManagersCategory,
  gitCategory,
  gitHooksCategory,
  editorCategory,
  docsCategory,
  legalCategory,
  releaseCategory,
  botsCategory,
  outputCategory,
  cacheCategory,
  coverageCategory,
  logsCategory,
  osJunkCategory,
  typingsCategory,
  storybookCategory,
  migrationsCategory,
  apiSchemaCategory,
  aiCategory,
];
