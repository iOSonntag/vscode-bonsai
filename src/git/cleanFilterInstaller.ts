import { promises as fileSystem } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { Uri, workspace, type LogOutputChannel } from 'vscode';
import {
  managedKeysStateFileVersion,
  parseManagedKeysStateFile,
  type ManagedKeysFileEntry,
  type ManagedKeysStateFile,
} from './cleanScript/managedKeysState.js';
import { runExecutable, runGitCommand } from './gitCommandRunner.js';
import { type GitRepository } from './gitRepository.js';

export interface NodeRuntime
{
  readonly executable: string;
  /** Set when the editor's own runtime stands in for Node. */
  readonly environmentPrefix: string;
}

export interface CleanFilterStatus
{
  readonly hasAttributesLine: boolean;
  readonly hasCleanCommand: boolean;
  readonly isCleanCommandCurrent: boolean;
  readonly isScriptCurrent: boolean;
  readonly isRuntimeWorking: boolean;
}

const filterName = 'bonsai';
const cleanCommandConfigKey = `filter.${filterName}.clean`;
const scriptFileName = 'git-clean-filter.cjs';
const bundledScriptRelativePath = `dist/${scriptFileName}`;

/** Installs, checks, repairs, and removes the local Git clean filter of one repository. */
export class CleanFilterInstaller
{
  public constructor(
    private readonly extensionUri: Uri,
    private readonly globalStorageUri: Uri,
    private readonly log: LogOutputChannel,
  )
  {
  }

  public isInstalled(status: CleanFilterStatus): boolean
  {
    return status.hasAttributesLine && status.hasCleanCommand;
  }

  public isHealthy(status: CleanFilterStatus): boolean
  {
    return this.isInstalled(status)
      && status.isCleanCommandCurrent
      && status.isScriptCurrent
      && status.isRuntimeWorking;
  }

  public async checkStatus(repository: GitRepository): Promise<CleanFilterStatus>
  {
    const attributesText = await readTextFileOrEmpty(repository.attributesFilePath);
    const hasAttributesLine = attributesText.split(/\r?\n/).includes(buildAttributesLine(repository));
    const configResult = await runGitCommand(repository.workTreePath, ['config', '--local', '--get', cleanCommandConfigKey]);
    const hasCleanCommand = configResult.exitCode === 0 && configResult.stdout.trim().length > 0;
    const scriptPath = this.scriptPath();
    const isScriptCurrent = await this.isScriptCopyCurrent(scriptPath);
    const runtime = await this.findWorkingRuntime();
    const expectedCommand = runtime === undefined ? undefined : buildCleanCommand(runtime, scriptPath, repository);
    return {
      hasAttributesLine,
      hasCleanCommand,
      isCleanCommandCurrent: hasCleanCommand && configResult.stdout.trim() === expectedCommand,
      isScriptCurrent,
      isRuntimeWorking: runtime !== undefined,
    };
  }

  /** Installs or repairs every part. Idempotent. Throws with a readable message when a part cannot be set up. */
  public async install(repository: GitRepository): Promise<void>
  {
    const runtime = await this.findWorkingRuntime();
    if (runtime === undefined)
    {
      throw new Error('No Node runtime is available to run the clean filter.');
    }
    const scriptPath = await this.ensureScriptCopy();
    await this.ensureAttributesLine(repository);
    const command = buildCleanCommand(runtime, scriptPath, repository);
    const configResult = await runGitCommand(repository.workTreePath, ['config', '--local', cleanCommandConfigKey, command]);
    if (configResult.exitCode !== 0)
    {
      throw new Error(`git config failed: ${configResult.stderr.trim()}`);
    }
    await this.ensureStateFileExists(repository);
    this.log.info(`Installed the Git clean filter in ${repository.workTreePath}.`);
  }

  public async uninstall(repository: GitRepository): Promise<void>
  {
    const attributesText = await readTextFileOrEmpty(repository.attributesFilePath);
    const attributesLine = buildAttributesLine(repository);
    const remainingLines = attributesText.split(/\r?\n/).filter((line) => line !== attributesLine);
    await writeTextFile(repository.attributesFilePath, remainingLines.join('\n'));
    await runGitCommand(repository.workTreePath, ['config', '--local', '--unset-all', cleanCommandConfigKey]);
    await fileSystem.rm(repository.stateFilePath, { force: true });
    this.log.info(`Removed the Git clean filter from ${repository.workTreePath}.`);
  }

  /** Records the managed keys of one settings file in the state file that the clean script reads. */
  public async writeStateEntry(repository: GitRepository, entry: ManagedKeysFileEntry): Promise<void>
  {
    const existingText = await readTextFileOrEmpty(repository.stateFilePath);
    const existingState = parseManagedKeysStateFile(existingText);
    const nextState: ManagedKeysStateFile = {
      version: managedKeysStateFileVersion,
      files: {
        ...(existingState?.files ?? {}),
        [repository.settingsFileRelativePath]: {
          managedKeys: [...entry.managedKeys],
          createdExcludeProperty: entry.createdExcludeProperty,
        },
      },
    };
    await writeTextFile(repository.stateFilePath, `${JSON.stringify(nextState, null, 2)}\n`);
  }

  private scriptPath(): string
  {
    return Uri.joinPath(this.globalStorageUri, scriptFileName).fsPath;
  }

  private async ensureScriptCopy(): Promise<string>
  {
    const scriptPath = this.scriptPath();
    if (await this.isScriptCopyCurrent(scriptPath))
    {
      return scriptPath;
    }
    const bundledScript = await workspace.fs.readFile(Uri.joinPath(this.extensionUri, bundledScriptRelativePath));
    await fileSystem.mkdir(dirname(scriptPath), { recursive: true });
    await fileSystem.writeFile(scriptPath, bundledScript);
    return scriptPath;
  }

  private async isScriptCopyCurrent(scriptPath: string): Promise<boolean>
  {
    try
    {
      const [bundledScript, copiedScript] = await Promise.all([
        workspace.fs.readFile(Uri.joinPath(this.extensionUri, bundledScriptRelativePath)),
        fileSystem.readFile(scriptPath),
      ]);
      return Buffer.compare(Buffer.from(bundledScript), copiedScript) === 0;
    }
    catch
    {
      return false;
    }
  }

  private async ensureAttributesLine(repository: GitRepository): Promise<void>
  {
    const attributesText = await readTextFileOrEmpty(repository.attributesFilePath);
    const attributesLine = buildAttributesLine(repository);
    if (attributesText.split(/\r?\n/).includes(attributesLine))
    {
      return;
    }
    const separator = attributesText.length === 0 || attributesText.endsWith('\n') ? '' : '\n';
    await writeTextFile(repository.attributesFilePath, `${attributesText}${separator}${attributesLine}\n`);
  }

  private async ensureStateFileExists(repository: GitRepository): Promise<void>
  {
    const existingText = await readTextFileOrEmpty(repository.stateFilePath);
    if (parseManagedKeysStateFile(existingText) !== undefined)
    {
      return;
    }
    const emptyState: ManagedKeysStateFile = { version: managedKeysStateFileVersion, files: {} };
    await writeTextFile(repository.stateFilePath, `${JSON.stringify(emptyState, null, 2)}\n`);
  }

  private async findWorkingRuntime(): Promise<NodeRuntime | undefined>
  {
    const candidates: NodeRuntime[] = [];
    const nodeOnPath = await findExecutableOnPath(process.platform === 'win32' ? 'node.exe' : 'node');
    if (nodeOnPath !== undefined)
    {
      candidates.push({ executable: nodeOnPath, environmentPrefix: '' });
    }
    candidates.push({ executable: process.execPath, environmentPrefix: 'ELECTRON_RUN_AS_NODE=1 ' });
    for (const candidate of candidates)
    {
      const environment = candidate.environmentPrefix.length > 0 ? { ELECTRON_RUN_AS_NODE: '1' } : {};
      const result = await runExecutable(candidate.executable, ['-e', 'process.exit(0)'], process.cwd(), environment);
      if (result.exitCode === 0)
      {
        return candidate;
      }
    }
    return undefined;
  }
}

function buildAttributesLine(repository: GitRepository): string
{
  return `"${repository.settingsFileRelativePath}" filter=${filterName}`;
}

function buildCleanCommand(runtime: NodeRuntime, scriptPath: string, repository: GitRepository): string
{
  const quote = (path: string): string => `"${path.replaceAll('\\', '/')}"`;
  return `${runtime.environmentPrefix}${quote(runtime.executable)} ${quote(scriptPath)} --state ${quote(repository.stateFilePath)} --file %f`;
}

async function findExecutableOnPath(fileName: string): Promise<string | undefined>
{
  const pathEntries = (process.env['PATH'] ?? '').split(delimiter).filter((entry) => entry.length > 0);
  for (const entry of pathEntries)
  {
    const candidate = join(entry, fileName);
    try
    {
      await fileSystem.access(candidate);
      return candidate;
    }
    catch
    {
      continue;
    }
  }
  return undefined;
}

async function readTextFileOrEmpty(path: string): Promise<string>
{
  try
  {
    return await fileSystem.readFile(path, 'utf8');
  }
  catch
  {
    return '';
  }
}

async function writeTextFile(path: string, text: string): Promise<void>
{
  await fileSystem.mkdir(dirname(path), { recursive: true });
  await fileSystem.writeFile(path, text, 'utf8');
}
