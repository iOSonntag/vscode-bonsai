import { splitRelativePath } from '../paths/relativePath.js';
import { expandBraceAlternatives } from './braceExpansion.js';

export interface GlobCompileOptions
{
  /** Case-insensitive matching. VS Code uses the case sensitivity of the operating system. */
  readonly ignoreCase: boolean;
}

interface GlobstarSegment
{
  readonly kind: 'globstar';
}

interface NameSegment
{
  readonly kind: 'name';
  readonly text: string;
  readonly matcher: RegExp;
}

type GlobSegment = GlobstarSegment | NameSegment;

/** A brace-free glob in the VS Code `files.exclude` dialect, compiled per path segment. */
export interface CompiledGlob
{
  /** The normalized pattern text after brace expansion. */
  readonly source: string;
  readonly segments: readonly GlobSegment[];
}

/**
 * The positions a glob can be in after it consumed a number of path segments.
 * A position equal to the segment count means the glob matched the whole path.
 */
export interface GlobMatchState
{
  readonly glob: CompiledGlob;
  readonly positions: ReadonlySet<number>;
}

/**
 * Compiles one pattern of the VS Code glob dialect. Brace alternatives expand to several globs.
 * An empty pattern yields no glob. A trailing slash is stripped. Consecutive `**` collapse.
 */
export function compileGlobPattern(pattern: string, options: GlobCompileOptions): CompiledGlob[]
{
  const compiledGlobs: CompiledGlob[] = [];
  for (const expandedPattern of expandBraceAlternatives(pattern.trim()))
  {
    const normalizedPattern = expandedPattern.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
    if (normalizedPattern.length === 0)
    {
      continue;
    }
    const segments: GlobSegment[] = [];
    for (const segmentText of normalizedPattern.split('/'))
    {
      if (segmentText.length === 0)
      {
        continue;
      }
      if (segmentText === '**')
      {
        const previousSegment = segments.at(-1);
        if (previousSegment?.kind === 'globstar')
        {
          continue;
        }
        segments.push({ kind: 'globstar' });
        continue;
      }
      segments.push({ kind: 'name', text: segmentText, matcher: compileSegmentMatcher(segmentText, options) });
    }
    if (segments.length === 0)
    {
      continue;
    }
    compiledGlobs.push({ source: normalizedPattern, segments });
  }
  return compiledGlobs;
}

/** The state of a glob before any path segment is consumed. */
export function createInitialMatchState(glob: CompiledGlob): GlobMatchState
{
  return { glob, positions: closeOverGlobstars(glob, new Set([0])) };
}

/** Consumes one path segment and returns the new state. */
export function advanceMatchState(state: GlobMatchState, segment: string): GlobMatchState
{
  const nextPositions = new Set<number>();
  for (const position of state.positions)
  {
    const globSegment = state.glob.segments[position];
    if (globSegment === undefined)
    {
      continue;
    }
    if (globSegment.kind === 'globstar')
    {
      nextPositions.add(position);
      continue;
    }
    if (globSegment.matcher.test(segment))
    {
      nextPositions.add(position + 1);
    }
  }
  return { glob: state.glob, positions: closeOverGlobstars(state.glob, nextPositions) };
}

/** True when the glob matched the whole path consumed so far. */
export function isFullMatch(state: GlobMatchState): boolean
{
  return state.positions.has(state.glob.segments.length);
}

/** True when the glob can still match a path strictly below the path consumed so far. */
export function canMatchBelow(state: GlobMatchState): boolean
{
  for (const position of state.positions)
  {
    if (position < state.glob.segments.length)
    {
      return true;
    }
  }
  return false;
}

/**
 * The remaining pattern texts that can still match below the path consumed so far.
 * A remainder that another remainder with a leading `**` already covers is left out.
 */
export function listResidualPatterns(state: GlobMatchState): string[]
{
  const remainders = new Set<string>();
  for (const position of state.positions)
  {
    if (position >= state.glob.segments.length)
    {
      continue;
    }
    remainders.add(formatSegmentsFrom(state.glob, position));
  }
  const residualPatterns: string[] = [];
  for (const remainder of remainders)
  {
    const coveringRemainder = `**/${remainder}`;
    if (remainders.has(coveringRemainder))
    {
      continue;
    }
    residualPatterns.push(remainder);
  }
  return residualPatterns;
}

/** Escapes the glob metacharacters of one name so that a key matches that literal name only. */
export function escapeGlobSegment(segment: string): string
{
  return segment.replace(/[[\]*?{}]/g, (character) => `[${character}]`);
}

/** Escapes every segment of a workspace-relative path for use as an exclude key. */
export function escapeGlobPath(relativePath: string): string
{
  return splitRelativePath(relativePath).map((segment) => escapeGlobSegment(segment)).join('/');
}

function closeOverGlobstars(glob: CompiledGlob, positions: Set<number>): Set<number>
{
  const closedPositions = new Set(positions);
  let hasGrown = true;
  while (hasGrown)
  {
    hasGrown = false;
    for (const position of closedPositions)
    {
      const globSegment = glob.segments[position];
      if (globSegment?.kind === 'globstar' && !closedPositions.has(position + 1))
      {
        closedPositions.add(position + 1);
        hasGrown = true;
      }
    }
  }
  return closedPositions;
}

function formatSegmentsFrom(glob: CompiledGlob, startPosition: number): string
{
  return glob.segments
    .slice(startPosition)
    .map((segment) => (segment.kind === 'globstar' ? '**' : segment.text))
    .join('/');
}

function compileSegmentMatcher(segmentText: string, options: GlobCompileOptions): RegExp
{
  let regexSource = '';
  let index = 0;
  while (index < segmentText.length)
  {
    const character = segmentText[index] ?? '';
    if (character === '*')
    {
      regexSource += '[^/]*';
      index += 1;
      continue;
    }
    if (character === '?')
    {
      regexSource += '[^/]';
      index += 1;
      continue;
    }
    if (character === '[')
    {
      const classEnd = findCharacterClassEnd(segmentText, index);
      if (classEnd !== undefined)
      {
        regexSource += compileCharacterClass(segmentText.slice(index + 1, classEnd));
        index = classEnd + 1;
        continue;
      }
    }
    regexSource += escapeRegExpCharacter(character);
    index += 1;
  }
  const flags = options.ignoreCase ? 'i' : '';
  try
  {
    return new RegExp(`^${regexSource}$`, flags);
  }
  catch
  {
    const literalSource = Array.from(segmentText, (character) => escapeRegExpCharacter(character)).join('');
    return new RegExp(`^${literalSource}$`, flags);
  }
}

function findCharacterClassEnd(segmentText: string, openIndex: number): number | undefined
{
  let index = openIndex + 1;
  if (segmentText[index] === '!' || segmentText[index] === '^')
  {
    index += 1;
  }
  if (segmentText[index] === ']')
  {
    index += 1;
  }
  const closeIndex = segmentText.indexOf(']', index);
  if (closeIndex < 0)
  {
    return undefined;
  }
  return closeIndex;
}

function compileCharacterClass(classContent: string): string
{
  let isNegated = false;
  let content = classContent;
  if (content.startsWith('!') || content.startsWith('^'))
  {
    isNegated = true;
    content = content.slice(1);
  }
  let escapedContent = '';
  for (const character of content)
  {
    escapedContent += character === '-' ? '-' : escapeRegExpCharacter(character);
  }
  return `[${isNegated ? '^' : ''}${escapedContent}]`;
}

function escapeRegExpCharacter(character: string): string
{
  return /[.*+?^${}()|[\]\\/]/.test(character) ? `\\${character}` : character;
}
