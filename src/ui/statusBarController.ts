import { MarkdownString, StatusBarAlignment, window, type Disposable, type StatusBarItem } from 'vscode';
import { type BonsaiConfigurationService } from '../configuration/bonsaiConfigurationService.js';
import { type FilterSession, type FilterSessionState } from '../explorer/filterSession.js';
import { commandIds } from './commandIds.js';

const statusBarPriority = 90;

/** Shows the active filter in the status bar. A click opens the filter picker. */
export class StatusBarController implements Disposable
{
  private readonly item: StatusBarItem;
  private readonly disposables: Disposable[] = [];

  public constructor(
    private readonly session: FilterSession,
    private readonly configurationService: BonsaiConfigurationService,
    private readonly extensionVersion: string,
  )
  {
    this.item = window.createStatusBarItem('bonsai.activeFilter', StatusBarAlignment.Left, statusBarPriority);
    this.item.name = 'Bonsai filter';
    this.item.command = commandIds.selectFilter;
    this.disposables.push(
      this.item,
      session.onDidChangeState((state) =>
      {
        this.render(state);
      }),
      configurationService.onDidChange(() =>
      {
        this.render(session.getState());
      }),
    );
    this.render(session.getState());
  }

  public dispose(): void
  {
    for (const disposable of this.disposables)
    {
      disposable.dispose();
    }
  }

  private render(state: FilterSessionState): void
  {
    const isEnabled = this.configurationService.resolveForFolder(undefined).isStatusBarEnabled;
    if (!isEnabled)
    {
      this.item.hide();
      return;
    }
    const icon = state.isBusy ? '$(sync~spin)' : state.problems.length > 0 || state.isPartial ? '$(warning)' : '$(filter)';
    this.item.text = `${icon} ${state.activeFilterLabel}`;
    const tooltip = new MarkdownString();
    tooltip.appendMarkdown(`**Bonsai ${this.extensionVersion}:** ${state.activeFilterLabel}\n\n`);
    if (state.isPartial)
    {
      tooltip.appendMarkdown('The walk reached the entry budget. The filter is partial.\n\n');
    }
    for (const problem of state.problems)
    {
      tooltip.appendMarkdown(`- ${problem}\n`);
    }
    tooltip.appendMarkdown('\nClick to select a filter.');
    this.item.tooltip = tooltip;
    this.item.show();
  }
}
