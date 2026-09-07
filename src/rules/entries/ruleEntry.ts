export interface GlobRuleEntry
{
  readonly kind: 'glob';
  readonly pattern: string;
}

export interface CategoryReferenceRuleEntry
{
  readonly kind: 'categoryReference';
  readonly categoryId: string;
}

/** Removes an inherited entry from a list. The target is a glob or a category reference. */
export interface RemovalRuleEntry
{
  readonly kind: 'removal';
  readonly target: GlobRuleEntry | CategoryReferenceRuleEntry;
}

/** One entry of a `patterns`, `hide`, or `show` list. */
export type RuleEntry = GlobRuleEntry | CategoryReferenceRuleEntry | RemovalRuleEntry;

export type RuleEntryParseResult =
  | { readonly kind: 'entry'; readonly entry: RuleEntry }
  | { readonly kind: 'invalid'; readonly reason: string };

const categoryReferencePrefix = 'category:';
const removalPrefix = '!';
const categoryIdPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Parses the string form of a rule entry: a glob, `category:<id>`, or a `!` removal of either. */
export function parseRuleEntry(text: string): RuleEntryParseResult
{
  const trimmedText = text.trim();
  if (trimmedText.startsWith(removalPrefix))
  {
    const targetResult = parseRuleEntry(trimmedText.slice(removalPrefix.length));
    if (targetResult.kind === 'invalid')
    {
      return targetResult;
    }
    if (targetResult.entry.kind === 'removal')
    {
      return { kind: 'invalid', reason: `A removal cannot remove a removal: "${text}".` };
    }
    return { kind: 'entry', entry: { kind: 'removal', target: targetResult.entry } };
  }
  if (trimmedText.startsWith(categoryReferencePrefix))
  {
    const categoryId = trimmedText.slice(categoryReferencePrefix.length);
    if (!categoryIdPattern.test(categoryId))
    {
      return { kind: 'invalid', reason: `"${categoryId}" is not a valid category id.` };
    }
    return { kind: 'entry', entry: { kind: 'categoryReference', categoryId } };
  }
  if (trimmedText.length === 0)
  {
    return { kind: 'invalid', reason: 'An entry cannot be empty.' };
  }
  return { kind: 'entry', entry: { kind: 'glob', pattern: trimmedText } };
}

/** The string form of a rule entry, the inverse of `parseRuleEntry`. */
export function formatRuleEntry(entry: RuleEntry): string
{
  switch (entry.kind)
  {
    case 'glob':
      return entry.pattern;
    case 'categoryReference':
      return `${categoryReferencePrefix}${entry.categoryId}`;
    case 'removal':
      return `${removalPrefix}${formatRuleEntry(entry.target)}`;
  }
}

export function areRuleEntriesEqual(first: RuleEntry, second: RuleEntry): boolean
{
  return formatRuleEntry(first) === formatRuleEntry(second);
}

/**
 * Applies additions to a base list in order. A glob or a reference appends once.
 * A removal drops every earlier occurrence of its target and stays in the list at its
 * position, so that a later expansion can apply it to the patterns of a category.
 */
export function mergeRuleEntryLists(base: readonly RuleEntry[], additions: readonly RuleEntry[]): RuleEntry[]
{
  const mergedEntries: RuleEntry[] = [];
  for (const entry of [...base, ...additions])
  {
    if (entry.kind === 'removal')
    {
      const target = entry.target;
      const remainingEntries = mergedEntries.filter((candidate) => !areRuleEntriesEqual(candidate, target));
      mergedEntries.splice(0, mergedEntries.length, ...remainingEntries, entry);
      continue;
    }
    if (mergedEntries.some((candidate) => areRuleEntriesEqual(candidate, entry)))
    {
      continue;
    }
    mergedEntries.push(entry);
  }
  return mergedEntries;
}
