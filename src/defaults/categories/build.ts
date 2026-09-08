import { type DefaultCategory } from '../defaultDefinitions.js';

export const buildCategory: DefaultCategory = {
  id: 'build',
  label: 'Build tool config',
  patterns: [
    'Rakefile',
    'gradlew',
    'gradlew.bat',
    'gradle.properties',
    'gradle/wrapper/gradle-wrapper.properties',
    '**/*.xcodeproj',
    '**/*.xcworkspace',
    '**/*.xcconfig',
    '**/Makefile',
    '**/CMakeLists.txt',
    'WORKSPACE',
    'WORKSPACE.bazel',
    'MODULE.bazel',
    '.bazelrc',
    '**/BUILD.bazel',
    'components.json',
  ],
};
