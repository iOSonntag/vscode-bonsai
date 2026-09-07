import { window, type ExtensionContext } from 'vscode';
import { BonsaiConfigurationService } from './configuration/bonsaiConfigurationService.js';
import { ExcludeSettingWriter } from './explorer/excludeSettingWriter.js';
import { FilterSession } from './explorer/filterSession.js';
import { FilterStateStore } from './explorer/filterStateStore.js';
import { GitIntegration } from './git/gitIntegration.js';
import { publishContextKeys } from './ui/contextKeys.js';
import { registerBonsaiCommands } from './ui/registerCommands.js';
import { StatusBarController } from './ui/statusBarController.js';

export async function activate(context: ExtensionContext): Promise<void>
{
  const log = window.createOutputChannel('Bonsai', { log: true });
  const configurationService = new BonsaiConfigurationService();
  const stateStore = new FilterStateStore(context.workspaceState);
  const writer = new ExcludeSettingWriter(log);
  const session = new FilterSession(configurationService, stateStore, writer, log);
  const gitIntegration = new GitIntegration(context, configurationService, stateStore, session, log);

  context.subscriptions.push(
    log,
    configurationService,
    session,
    gitIntegration,
    new StatusBarController(session, configurationService),
    session.onDidChangeState((state) =>
    {
      void publishContextKeys(state);
    }),
    ...registerBonsaiCommands({ session, gitIntegration, log }),
  );

  await publishContextKeys(session.getState());
  gitIntegration.start();
  await session.start();
  log.info('Bonsai is active.');
}
