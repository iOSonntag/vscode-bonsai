import { type FilterBaseMode, type ResolvedFilter } from '../catalog/filterCatalog.js';
import {
  advanceMatchState,
  canMatchBelow,
  compileGlobPattern,
  createInitialMatchState,
  escapeGlobPath,
  isFullMatch,
  listResidualPatterns,
  type GlobMatchState,
} from '../glob/globPattern.js';
import { appendPathSegment } from '../paths/relativePath.js';
import { type DirectoryEntry, type DirectoryReader } from './directoryReader.js';
import { type FolderNameMatcher, type RelativePathMatcher } from './pathMatchers.js';

export interface CancellationSignal
{
  readonly isCancellationRequested: boolean;
}

export interface ExclusionPlanRequest
{
  readonly filter: ResolvedFilter;
  readonly reader: DirectoryReader;
  /** True for a folder name that the walk must never open. */
  readonly isLeafFolderName: FolderNameMatcher;
  /** True for a path that the effective exclude setting already hides without Bonsai. */
  readonly isHiddenByBaseline: RelativePathMatcher;
  /** The walk stops opening folders after it read this many entries. */
  readonly maxEntries: number;
  readonly ignoreCase: boolean;
  readonly cancellation?: CancellationSignal;
}

/** The generated keys for one workspace folder and one filter. Every key is ready for the exclude setting. */
export interface ExclusionPlan
{
  /** Patterns that VS Code evaluates itself. */
  readonly globEntries: readonly string[];
  /** Paths that the walk found, with glob metacharacters escaped so that each key matches one literal path. */
  readonly concreteEntries: readonly string[];
  readonly entriesRead: number;
  /** True when the walk hit the entry budget. Unopened folders are treated as leaf folders. */
  readonly isPartial: boolean;
}

export class WalkCancelledError extends Error
{
  constructor()
  {
    super('The walk was cancelled.');
    this.name = 'WalkCancelledError';
  }
}

/**
 * Computes the generated keys for a filter. Only conflict folders are opened. Leaf folders
 * are decided as a whole. Throws `WalkCancelledError` when the cancellation signal fires.
 */
export async function computeExclusionPlan(request: ExclusionPlanRequest): Promise<ExclusionPlan>
{
  const walker = new PlanWalker(request);
  const subtree = await walker.planRoot();
  return {
    globEntries: sortUnique(subtree.globEntries),
    concreteEntries: sortUnique(subtree.concreteEntries),
    entriesRead: walker.entriesRead,
    isPartial: walker.isPartial,
  };
}

interface RuleStates
{
  readonly hide: readonly GlobMatchState[];
  readonly show: readonly GlobMatchState[];
}

interface SubtreePlan
{
  readonly visibleChildCount: number;
  readonly globEntries: readonly string[];
  readonly concreteEntries: readonly string[];
}

const emptySubtree: SubtreePlan = { visibleChildCount: 0, globEntries: [], concreteEntries: [] };

class PlanWalker
{
  public entriesRead = 0;
  public isPartial = false;

  private readonly baseMode: FilterBaseMode;
  private readonly initialStates: RuleStates;

  public constructor(private readonly request: ExclusionPlanRequest)
  {
    this.baseMode = request.filter.base;
    const compileList = (patterns: readonly string[]): GlobMatchState[] =>
      patterns
        .flatMap((pattern) => compileGlobPattern(pattern, { ignoreCase: request.ignoreCase }))
        .map((glob) => createInitialMatchState(glob));
    this.initialStates = {
      hide: compileList(request.filter.hidePatterns),
      show: compileList(request.filter.showPatterns),
    };
  }

  public async planRoot(): Promise<SubtreePlan>
  {
    const states = this.initialStates;
    const hideGlobs = states.hide.map((state) => state.glob.source);
    if (this.baseMode === 'hideAll')
    {
      if (isAnyFullMatch(states.show))
      {
        return { ...emptySubtree, globEntries: hideGlobs };
      }
      const subtree = await this.visitHiddenFolder('', states);
      return { ...subtree, globEntries: [...hideGlobs, ...subtree.globEntries] };
    }
    if (states.show.length === 0)
    {
      return { ...emptySubtree, globEntries: hideGlobs };
    }
    if (isAnyFullMatch(states.hide))
    {
      return this.visitHiddenFolder('', states);
    }
    return this.planVisibleFolder('', states, true);
  }

  private async planVisibleFolder(folderPath: string, states: RuleStates, canOpen: boolean): Promise<SubtreePlan>
  {
    const hideReaches = canAnyMatchBelow(states.hide);
    const showReaches = canAnyMatchBelow(states.show);
    if (!hideReaches)
    {
      return emptySubtree;
    }
    if (!showReaches || !canOpen)
    {
      return { ...emptySubtree, globEntries: collectResidualGlobs(states.hide, folderPath) };
    }
    return this.visitVisibleFolder(folderPath, states);
  }

  private async visitVisibleFolder(folderPath: string, states: RuleStates): Promise<SubtreePlan>
  {
    const children = await this.readChildren(folderPath);
    const pendingSubtrees: Promise<SubtreePlan>[] = [];
    const concreteEntries: string[] = [];
    const globEntries: string[] = [];
    let visibleChildCount = 0;
    for (const child of children)
    {
      const childPath = appendPathSegment(folderPath, child.name);
      if (this.request.isHiddenByBaseline(childPath))
      {
        continue;
      }
      const childStates = advanceRuleStates(states, child.name);
      if (isAnyFullMatch(childStates.show))
      {
        visibleChildCount += 1;
        continue;
      }
      const canOpen = this.canOpenFolder(child);
      if (isAnyFullMatch(childStates.hide))
      {
        if (canOpen && canAnyMatchBelow(childStates.show))
        {
          pendingSubtrees.push(this.visitHiddenFolder(childPath, childStates).then((subtree) =>
            collapseWhenNothingVisible(subtree, childPath)));
          continue;
        }
        concreteEntries.push(escapeGlobPath(childPath));
        continue;
      }
      visibleChildCount += 1;
      if (child.kind === 'directory')
      {
        pendingSubtrees.push(this.planVisibleFolder(childPath, childStates, canOpen));
      }
    }
    const subtrees = await Promise.all(pendingSubtrees);
    for (const subtree of subtrees)
    {
      concreteEntries.push(...subtree.concreteEntries);
      globEntries.push(...subtree.globEntries);
      visibleChildCount += subtree.visibleChildCount > 0 ? 1 : 0;
    }
    return { visibleChildCount, globEntries, concreteEntries };
  }

  private async visitHiddenFolder(folderPath: string, states: RuleStates): Promise<SubtreePlan>
  {
    const children = await this.readChildren(folderPath);
    const pendingSubtrees: Promise<SubtreePlan>[] = [];
    const concreteEntries: string[] = [];
    let visibleChildCount = 0;
    for (const child of children)
    {
      const childPath = appendPathSegment(folderPath, child.name);
      if (this.request.isHiddenByBaseline(childPath))
      {
        continue;
      }
      const childStates = advanceRuleStates(states, child.name);
      if (this.baseMode === 'hideAll' && isAnyFullMatch(childStates.hide))
      {
        continue;
      }
      if (isAnyFullMatch(childStates.show))
      {
        visibleChildCount += 1;
        continue;
      }
      if (this.canOpenFolder(child) && canAnyMatchBelow(childStates.show))
      {
        pendingSubtrees.push(this.visitHiddenFolder(childPath, childStates).then((subtree) =>
          collapseWhenNothingVisible(subtree, childPath)));
        continue;
      }
      concreteEntries.push(escapeGlobPath(childPath));
    }
    const subtrees = await Promise.all(pendingSubtrees);
    const globEntries: string[] = [];
    for (const subtree of subtrees)
    {
      concreteEntries.push(...subtree.concreteEntries);
      globEntries.push(...subtree.globEntries);
      visibleChildCount += subtree.visibleChildCount > 0 ? 1 : 0;
    }
    return { visibleChildCount, globEntries, concreteEntries };
  }

  private canOpenFolder(entry: DirectoryEntry): boolean
  {
    if (entry.kind !== 'directory' || this.request.isLeafFolderName(entry.name))
    {
      return false;
    }
    if (this.entriesRead >= this.request.maxEntries)
    {
      this.isPartial = true;
      return false;
    }
    return true;
  }

  private async readChildren(folderPath: string): Promise<readonly DirectoryEntry[]>
  {
    if (this.request.cancellation?.isCancellationRequested === true)
    {
      throw new WalkCancelledError();
    }
    const children = await this.request.reader.readDirectory(folderPath);
    this.entriesRead += children.length;
    return children;
  }
}

function collapseWhenNothingVisible(subtree: SubtreePlan, folderPath: string): SubtreePlan
{
  return subtree.visibleChildCount === 0 ? { ...emptySubtree, concreteEntries: [escapeGlobPath(folderPath)] } : subtree;
}

function advanceRuleStates(states: RuleStates, segment: string): RuleStates
{
  return {
    hide: states.hide.map((state) => advanceMatchState(state, segment)),
    show: states.show.map((state) => advanceMatchState(state, segment)),
  };
}

function isAnyFullMatch(states: readonly GlobMatchState[]): boolean
{
  return states.some((state) => isFullMatch(state));
}

function canAnyMatchBelow(states: readonly GlobMatchState[]): boolean
{
  return states.some((state) => canMatchBelow(state));
}

function collectResidualGlobs(states: readonly GlobMatchState[], folderPath: string): string[]
{
  const residualGlobs: string[] = [];
  const escapedFolderPath = escapeGlobPath(folderPath);
  for (const state of states)
  {
    for (const residualPattern of listResidualPatterns(state))
    {
      residualGlobs.push(appendPathSegment(escapedFolderPath, residualPattern));
    }
  }
  return residualGlobs;
}

function sortUnique(values: readonly string[]): string[]
{
  return [...new Set(values)].sort((first, second) => first.localeCompare(second));
}
