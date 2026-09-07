import { commands, type Disposable, type LogOutputChannel } from 'vscode';
import { type FilterSession } from '../explorer/filterSession.js';
import { type GitIntegration } from '../git/gitIntegration.js';
import { allFilterId } from '../rules/catalog/filterCatalog.js';
import { commandIds } from './commandIds.js';
import { showFilterQuickPick } from './filterQuickPick.js';

export interface CommandDependencies
{
  readonly session: FilterSession;
  readonly gitIntegration: GitIntegration;
  readonly log: LogOutputChannel;
}

/** Registers every Bonsai command. The returned disposables unregister them. */
export function registerBonsaiCommands(dependencies: CommandDependencies): Disposable[]
{
  const { session, gitIntegration, log } = dependencies;
  const applyFilterById = (filterId: unknown): Promise<void> =>
    (typeof filterId === 'string' ? session.applyFilter(filterId) : showFilterQuickPick(session));
  return [
    commands.registerCommand(commandIds.selectFilter, () => showFilterQuickPick(session)),
    commands.registerCommand(commandIds.cycleFilter, () => session.cycleFilter()),
    commands.registerCommand(commandIds.applyFilter, applyFilterById),
    commands.registerCommand(commandIds.applyAllFilter, () => session.applyFilter(allFilterId)),
    commands.registerCommand(commandIds.applyCodingFilter, () => session.applyFilter('coding')),
    commands.registerCommand(commandIds.applySetupFilter, () => session.applyFilter('setup')),
    commands.registerCommand(commandIds.applyAiFilter, () => session.applyFilter('ai')),
    commands.registerCommand(commandIds.refresh, () => session.refresh()),
    commands.registerCommand(commandIds.clearGeneratedKeys, () => session.applyFilter(allFilterId)),
    commands.registerCommand(commandIds.installGitCleanFilter, () => gitIntegration.installForAllFolders()),
    commands.registerCommand(commandIds.checkGitCleanFilter, () => gitIntegration.reportStatusForAllFolders()),
    commands.registerCommand(commandIds.uninstallGitCleanFilter, () => gitIntegration.uninstallForAllFolders()),
    commands.registerCommand(commandIds.showOutput, () =>
    {
      log.show(true);
    }),
  ];
}
