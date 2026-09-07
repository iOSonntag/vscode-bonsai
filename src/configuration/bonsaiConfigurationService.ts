import { EventEmitter, workspace, type Disposable, type Event, type WorkspaceFolder } from 'vscode';
import { defaultDefinitions } from '../defaults/index.js';
import { type FilterCatalog } from '../rules/catalog/filterCatalog.js';
import { mergeCatalogLayers } from './catalogMerge.js';
import { type ConfigurationLayer, type ConfigurationProblem, type ConfigurationScopeName } from './configurationLayer.js';
import { validateConfigurationLayer } from './settingsValidation.js';

export type CleanFilterMode = 'ask' | 'always' | 'never';

/** The effective Bonsai configuration for one workspace folder. */
export interface ResolvedConfiguration
{
  readonly catalog: FilterCatalog;
  readonly leafFolders: readonly string[];
  readonly maxWalkEntries: number;
  readonly cleanFilterMode: CleanFilterMode;
  readonly isStatusBarEnabled: boolean;
  readonly problems: readonly ConfigurationProblem[];
}

const configurationSection = 'bonsai';
const defaultMaxWalkEntries = 50000;

/** Reads the `bonsai.*` settings of every scope and merges them with the shipped defaults. */
export class BonsaiConfigurationService implements Disposable
{
  public readonly onDidChange: Event<void>;

  private readonly changeEmitter = new EventEmitter<void>();
  private readonly subscription: Disposable;

  public constructor()
  {
    this.onDidChange = this.changeEmitter.event;
    this.subscription = workspace.onDidChangeConfiguration((event) =>
    {
      if (event.affectsConfiguration(configurationSection))
      {
        this.changeEmitter.fire();
      }
    });
  }

  public resolveForFolder(folder: WorkspaceFolder | undefined): ResolvedConfiguration
  {
    const configuration = workspace.getConfiguration(configurationSection, folder?.uri);
    const layers: ConfigurationLayer[] = [];
    const problems: ConfigurationProblem[] = [];
    const categoriesInspection = configuration.inspect<unknown>('categories');
    const filtersInspection = configuration.inspect<unknown>('filters');
    const leafFoldersInspection = configuration.inspect<unknown>('leafFolders');
    const scopes: readonly [ConfigurationScopeName, 'globalValue' | 'workspaceValue' | 'workspaceFolderValue'][] = [
      ['user', 'globalValue'],
      ['workspace', 'workspaceValue'],
      ['workspaceFolder', 'workspaceFolderValue'],
    ];
    for (const [scope, property] of scopes)
    {
      const validation = validateConfigurationLayer(scope, {
        categories: categoriesInspection?.[property],
        filters: filtersInspection?.[property],
        leafFolders: leafFoldersInspection?.[property],
      });
      layers.push(validation.layer);
      problems.push(...validation.problems);
    }
    const hidePackageManifests = configuration.get<boolean>('coding.hidePackageManifests', false);
    const mergeResult = mergeCatalogLayers(defaultDefinitions, layers, { hidePackageManifests });
    problems.push(...mergeResult.problems);
    return {
      catalog: mergeResult.catalog,
      leafFolders: mergeResult.leafFolders,
      maxWalkEntries: readPositiveInteger(configuration.get<unknown>('maxWalkEntries'), defaultMaxWalkEntries),
      cleanFilterMode: readCleanFilterMode(configuration.get<unknown>('git.cleanFilter')),
      isStatusBarEnabled: configuration.get<boolean>('statusBar.enabled', true),
      problems,
    };
  }

  public dispose(): void
  {
    this.subscription.dispose();
    this.changeEmitter.dispose();
  }
}

function readPositiveInteger(value: unknown, fallback: number): number
{
  if (typeof value === 'number' && Number.isInteger(value) && value > 0)
  {
    return value;
  }
  return fallback;
}

function readCleanFilterMode(value: unknown): CleanFilterMode
{
  if (value === 'always' || value === 'never')
  {
    return value;
  }
  return 'ask';
}
