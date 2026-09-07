import { type FilterBaseMode } from '../rules/catalog/filterCatalog.js';

/** A shipped category. Patterns use the VS Code glob dialect and may reference other categories. */
export interface DefaultCategory
{
  readonly id: string;
  readonly label: string;
  readonly patterns: readonly string[];
}

/** A shipped filter. Lists hold globs and category references. A filter that extends another may omit the base mode. */
export interface DefaultFilter
{
  readonly id: string;
  readonly label: string;
  readonly base?: FilterBaseMode;
  readonly extends?: string;
  readonly hide: readonly string[];
  readonly show: readonly string[];
}

/** Everything Bonsai ships before any user setting applies. */
export interface DefaultDefinitions
{
  readonly categories: readonly DefaultCategory[];
  readonly filters: readonly DefaultFilter[];
  readonly leafFolders: readonly string[];
}
