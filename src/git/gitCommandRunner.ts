import { execFile } from 'node:child_process';
import { workspace } from 'vscode';
import * as z from 'zod/mini';

export interface GitCommandResult
{
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const outputLimitBytes = 8 * 1024 * 1024;
const commandTimeoutMs = 15000;

/** Runs the Git executable with the given arguments in a directory. Never throws; a failure shows in the exit code. */
export function runGitCommand(workingDirectory: string, args: readonly string[]): Promise<GitCommandResult>
{
  return runExecutable(findGitExecutable(), args, workingDirectory, {});
}

/** Like `runGitCommand`, with text on standard input. */
export function runGitCommandWithInput(
  workingDirectory: string,
  args: readonly string[],
  standardInput: string,
): Promise<GitCommandResult>
{
  return runExecutable(findGitExecutable(), args, workingDirectory, {}, standardInput);
}

/** Runs any executable with arguments, an environment addition, and standard input. Never throws. */
export function runExecutable(
  executable: string,
  args: readonly string[],
  workingDirectory: string,
  environment: Readonly<Record<string, string>>,
  standardInput?: string,
): Promise<GitCommandResult>
{
  return new Promise((resolve) =>
  {
    const child = execFile(
      executable,
      [...args],
      {
        cwd: workingDirectory,
        maxBuffer: outputLimitBytes,
        timeout: commandTimeoutMs,
        env: { ...process.env, ...environment },
      },
      (error, stdout, stderr) =>
      {
        const exitCode = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
        resolve({ exitCode, stdout, stderr: error !== null && stderr.length === 0 ? error.message : stderr });
      },
    );
    if (standardInput !== undefined && child.stdin !== null)
    {
      child.stdin.end(standardInput);
    }
  });
}

const gitPathSettingSchema = z.union([z.string(), z.array(z.string())]);

function findGitExecutable(): string
{
  const parsed = gitPathSettingSchema.safeParse(workspace.getConfiguration('git').get<unknown>('path'));
  if (!parsed.success)
  {
    return 'git';
  }
  const candidates = typeof parsed.data === 'string' ? [parsed.data] : parsed.data;
  return candidates.find((candidate) => candidate.length > 0) ?? 'git';
}
