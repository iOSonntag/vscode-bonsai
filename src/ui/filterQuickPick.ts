import { window, type QuickPickItem } from 'vscode';
import { type FilterSession } from '../explorer/filterSession.js';

interface FilterQuickPickItem extends QuickPickItem
{
  readonly filterId: string;
}

/** Lets the user pick a filter and applies it. */
export async function showFilterQuickPick(session: FilterSession): Promise<void>
{
  const items = session.listFilters().map((filter): FilterQuickPickItem => ({
    filterId: filter.id,
    label: filter.isActive ? `$(check) ${filter.label}` : `$(blank) ${filter.label}`,
    description: filter.isActive ? 'active' : '',
  }));
  const picked = await window.showQuickPick(items, { placeHolder: 'Select the Bonsai filter for the Explorer' });
  if (picked !== undefined)
  {
    await session.applyFilter(picked.filterId);
  }
}
