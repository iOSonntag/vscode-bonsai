import { type RuleEntry } from '../entries/ruleEntry.js';

export type FilterBaseMode = 'showAll' | 'hideAll';

/** A named set of patterns that says what a file is. */
export interface CategoryDefinition
{
  readonly id: string;
  readonly label: string;
  /** Globs, references to other categories, and removals, applied in order. */
  readonly entries: readonly RuleEntry[];
}

/** What a button activates. Lists hold globs, category references, and removals, applied in order. */
export interface FilterDefinition
{
  readonly id: string;
  readonly label: string;
  /** Optional when the filter extends another filter. */
  readonly base?: FilterBaseMode;
  readonly extends?: string;
  readonly enabled: boolean;
  readonly hide: readonly RuleEntry[];
  readonly show: readonly RuleEntry[];
}

/** All categories and filters after every configuration layer is merged. */
export interface FilterCatalog
{
  readonly categories: ReadonlyMap<string, CategoryDefinition>;
  readonly filters: ReadonlyMap<string, FilterDefinition>;
}

/** A filter with every reference expanded to plain glob patterns. */
export interface ResolvedFilter
{
  readonly id: string;
  readonly label: string;
  readonly base: FilterBaseMode;
  readonly hidePatterns: readonly string[];
  readonly showPatterns: readonly string[];
}

export type CatalogProblemCode =
  | 'unknownCategory'
  | 'categoryCycle'
  | 'unknownParentFilter'
  | 'filterCycle'
  | 'missingBaseMode';

export interface CatalogProblem
{
  readonly code: CatalogProblemCode;
  readonly filterId: string;
  readonly message: string;
}

/** The id of the implicit filter that has no rules and removes every generated key. */
export const allFilterId = 'all';
