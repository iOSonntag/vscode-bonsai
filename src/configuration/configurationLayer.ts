/** Where a configuration value came from, in merge order. */
export type ConfigurationScopeName = 'defaults' | 'user' | 'workspace' | 'workspaceFolder';

/** The raw `bonsai.categories` value of one scope. */
export interface RawCategoryDefinition
{
  readonly label?: string | undefined;
  readonly patterns?: readonly string[] | undefined;
}

/** The raw `bonsai.filters` value of one scope. */
export interface RawFilterDefinition
{
  readonly label?: string | undefined;
  readonly base?: 'showAll' | 'hideAll' | undefined;
  readonly extends?: string | undefined;
  readonly enabled?: boolean | undefined;
  readonly hide?: readonly string[] | undefined;
  readonly show?: readonly string[] | undefined;
}

/** The validated Bonsai settings of one scope. */
export interface ConfigurationLayer
{
  readonly scope: ConfigurationScopeName;
  readonly categories: Readonly<Record<string, RawCategoryDefinition>>;
  readonly filters: Readonly<Record<string, RawFilterDefinition>>;
  readonly leafFolders: readonly string[];
}

/** A problem in a setting value. The path points at the setting and the entry. */
export interface ConfigurationProblem
{
  readonly scope: ConfigurationScopeName;
  readonly path: string;
  readonly message: string;
}
