import { readFileSync } from 'node:fs';
import { parseManagedKeysStateFile, normalizeStatePath } from './managedKeysState.js';
import { stripManagedKeysFromSettings } from './stripManagedKeys.js';

function readStandardInput(): string
{
  return readFileSync(0, 'utf8');
}

function findArgumentValue(name: string): string | undefined
{
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function runCleanFilter(): void
{
  const inputText = readStandardInput();
  let outputText = inputText;
  try
  {
    const statePath = findArgumentValue('--state');
    const filePath = findArgumentValue('--file');
    if (statePath !== undefined && filePath !== undefined)
    {
      const stateFile = parseManagedKeysStateFile(readFileSync(statePath, 'utf8'));
      const entry = stateFile?.files[normalizeStatePath(filePath)];
      if (entry !== undefined)
      {
        outputText = stripManagedKeysFromSettings(inputText, {
          managedKeys: entry.managedKeys,
          removeExcludePropertyWhenEmpty: entry.createdExcludeProperty,
        });
      }
    }
  }
  catch (error)
  {
    process.stderr.write(`bonsai clean filter: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.stdout.write(outputText);
}

runCleanFilter();
