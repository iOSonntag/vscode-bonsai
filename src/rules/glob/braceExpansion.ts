/**
 * Expands `{a,b}` alternatives of a glob into a list of brace-free globs.
 * Nested braces are supported. A brace group without a comma stays literal.
 */
export function expandBraceAlternatives(pattern: string): string[]
{
  const group = findFirstBraceGroup(pattern);
  if (group === undefined)
  {
    return [pattern];
  }
  const prefix = pattern.slice(0, group.start);
  const suffix = pattern.slice(group.end + 1);
  const alternatives = splitTopLevelAlternatives(pattern.slice(group.start + 1, group.end));
  if (alternatives.length < 2)
  {
    const literalPrefix = pattern.slice(0, group.end + 1);
    return expandBraceAlternatives(suffix).map((expandedSuffix) => `${literalPrefix}${expandedSuffix}`);
  }
  const expandedPatterns: string[] = [];
  for (const alternative of alternatives)
  {
    for (const expandedPattern of expandBraceAlternatives(`${prefix}${alternative}${suffix}`))
    {
      expandedPatterns.push(expandedPattern);
    }
  }
  return expandedPatterns;
}

interface BraceGroupRange
{
  readonly start: number;
  readonly end: number;
}

function findFirstBraceGroup(pattern: string): BraceGroupRange | undefined
{
  const start = pattern.indexOf('{');
  if (start < 0)
  {
    return undefined;
  }
  let depth = 0;
  for (let index = start; index < pattern.length; index += 1)
  {
    const character = pattern[index];
    if (character === '{')
    {
      depth += 1;
    }
    else if (character === '}')
    {
      depth -= 1;
      if (depth === 0)
      {
        return { start, end: index };
      }
    }
  }
  return undefined;
}

function splitTopLevelAlternatives(groupContent: string): string[]
{
  const alternatives: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of groupContent)
  {
    if (character === '{')
    {
      depth += 1;
    }
    else if (character === '}')
    {
      depth -= 1;
    }
    if (character === ',' && depth === 0)
    {
      alternatives.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  alternatives.push(current);
  return alternatives;
}
