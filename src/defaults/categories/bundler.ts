import { type DefaultCategory } from '../defaultDefinitions.js';

export const bundlerCategory: DefaultCategory = {
  id: 'bundler',
  label: 'Bundler config',
  patterns: [
    '**/webpack.config.*',
    '**/rollup.config.*',
    '**/vite.config.*',
    '**/esbuild.config.*',
    '**/tsup.config.*',
    '**/next.config.*',
    '**/nuxt.config.*',
    'angular.json',
    '**/gulpfile.js',
    '**/Gruntfile.js',
    '**/metro.config.js',
  ],
};
