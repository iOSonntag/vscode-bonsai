const assert = require('node:assert/strict');
const vscode = require('vscode');

const extensionId = 'iOSonntag.vscode-bonsai';

function readWorkspaceExcludeKeys()
{
  const folder = vscode.workspace.workspaceFolders?.[0];
  const inspection = vscode.workspace.getConfiguration('files', folder?.uri).inspect('exclude');
  return Object.keys(inspection?.workspaceValue ?? {}).sort();
}

async function waitForExcludeKeys(predicate, timeoutMs)
{
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs)
  {
    const keys = readWorkspaceExcludeKeys();
    if (predicate(keys))
    {
      return keys;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return readWorkspaceExcludeKeys();
}

suite('Bonsai', () =>
{
  suiteSetup(async () =>
  {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, 'The extension is installed in the test host.');
    await extension.activate();
  });

  suiteTeardown(async () =>
  {
    await vscode.commands.executeCommand('bonsai.filter.all');
    await waitForExcludeKeys((keys) => keys.length === 1, 10000);
  });

  test('the Coding filter writes glob entries and keeps the user key', async () =>
  {
    await vscode.commands.executeCommand('bonsai.filter.coding');
    const keys = await waitForExcludeKeys((keys) => keys.includes('**/eslint.config.*'), 10000);
    assert.ok(keys.includes('**/.git'), 'the user key stays');
    assert.ok(keys.includes('**/eslint.config.*'), 'lint config is hidden');
    assert.ok(keys.includes('**/node_modules'), 'dependency folders are hidden');
    assert.ok(!keys.includes('**/package.json'), 'package manifests stay visible');
  });

  test('the AI filter writes concrete entries and never opens leaf folders', async () =>
  {
    await vscode.commands.executeCommand('bonsai.filter.ai');
    const keys = await waitForExcludeKeys((keys) => keys.includes('src/index.ts'), 10000);
    assert.ok(keys.includes('src/index.ts'), 'a source file next to a nested CLAUDE.md is hidden');
    assert.ok(keys.includes('docs'), 'a folder without AI files collapses to one entry');
    assert.ok(keys.includes('node_modules'), 'a leaf folder is hidden as a whole');
    assert.ok(!keys.includes('src'), 'the folder with a nested CLAUDE.md stays visible');
    assert.ok(!keys.includes('CLAUDE.md'), 'the root CLAUDE.md stays visible');
    assert.ok(!keys.includes('.claude'), 'the .claude folder stays visible');
    assert.ok(!keys.includes('**/eslint.config.*'), 'the Coding keys are gone');
  });

  test('the All filter removes every generated key', async () =>
  {
    await vscode.commands.executeCommand('bonsai.filter.all');
    const keys = await waitForExcludeKeys((keys) => keys.length === 1, 10000);
    assert.deepEqual(keys, ['**/.git']);
  });
});
