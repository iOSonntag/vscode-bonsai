import * as esbuild from 'esbuild';

const isWatchMode = process.argv.includes('--watch');

const extensionBuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  mainFields: ['module', 'main'],
  banner: {
    js: "import { createRequire as bonsaiCreateRequire } from 'node:module';\nconst require = bonsaiCreateRequire(import.meta.url);",
  },
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

const cleanScriptBuildOptions = {
  entryPoints: ['src/git/cleanScript/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/git-clean-filter.cjs',
  mainFields: ['module', 'main'],
  sourcemap: false,
  minify: true,
  logLevel: 'info',
};

async function runBuild()
{
  if (isWatchMode)
  {
    const extensionContext = await esbuild.context(extensionBuildOptions);
    const cleanScriptContext = await esbuild.context(cleanScriptBuildOptions);
    await Promise.all([extensionContext.watch(), cleanScriptContext.watch()]);
    return;
  }
  await Promise.all([esbuild.build(extensionBuildOptions), esbuild.build(cleanScriptBuildOptions)]);
}

await runBuild();
