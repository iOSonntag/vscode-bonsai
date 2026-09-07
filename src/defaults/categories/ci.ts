import { type DefaultCategory } from '../defaultDefinitions.js';

export const ciCategory: DefaultCategory = {
  id: 'ci',
  label: 'CI and CD config',
  patterns: [
    '.github',
    '.gitlab-ci.yml',
    '.circleci',
    'azure-pipelines.yml',
    'Jenkinsfile',
    '.travis.yml',
    'bitbucket-pipelines.yml',
    '.drone.yml',
    'cloudbuild.yaml',
    '.buildkite',
    'appveyor.yml',
  ],
};
