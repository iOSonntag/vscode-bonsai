import { commands } from 'vscode';
import { type FilterSessionState } from '../explorer/filterSession.js';
import { allFilterId } from '../rules/catalog/filterCatalog.js';

const activeFilterContextKey = 'bonsai.activeFilterId';
const isFilteringContextKey = 'bonsai.isFiltering';

/** Publishes the active filter to `when` clauses of menus and keybindings. */
export async function publishContextKeys(state: FilterSessionState): Promise<void>
{
  await commands.executeCommand('setContext', activeFilterContextKey, state.activeFilterId);
  await commands.executeCommand('setContext', isFilteringContextKey, state.activeFilterId !== allFilterId);
}
