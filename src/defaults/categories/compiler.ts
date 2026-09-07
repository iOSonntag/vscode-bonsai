import { type DefaultCategory } from '../defaultDefinitions.js';

export const compilerCategory: DefaultCategory = {
  id: 'compiler',
  label: 'Compiler and language config',
  patterns: [
    '**/tsconfig*.json',
    '**/jsconfig.json',
    '**/.babelrc*',
    '**/babel.config.*',
    'mypy.ini',
    'rust-toolchain.toml',
    'rust-toolchain',
    'analysis_options.yaml',
    'global.json',
    '.swift-version',
  ],
};
