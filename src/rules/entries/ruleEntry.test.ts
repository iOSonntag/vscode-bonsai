import { describe, expect, it } from 'vitest';
import { formatRuleEntry, mergeRuleEntryLists, parseRuleEntry, type RuleEntry } from './ruleEntry.js';

function parseEntryOrThrow(text: string): RuleEntry
{
  const result = parseRuleEntry(text);
  if (result.kind === 'invalid')
  {
    throw new Error(result.reason);
  }
  return result.entry;
}

describe('parseRuleEntry', () =>
{
  it('parses a glob, a category reference, and removals of both', () =>
  {
    expect(parseEntryOrThrow('**/*.log')).toEqual({ kind: 'glob', pattern: '**/*.log' });
    expect(parseEntryOrThrow('category:lint')).toEqual({ kind: 'categoryReference', categoryId: 'lint' });
    expect(parseEntryOrThrow('!**/*.log')).toEqual({ kind: 'removal', target: { kind: 'glob', pattern: '**/*.log' } });
    expect(parseEntryOrThrow('!category:lint')).toEqual({
      kind: 'removal',
      target: { kind: 'categoryReference', categoryId: 'lint' },
    });
  });

  it('rejects an empty entry, a double removal, and a bad category id', () =>
  {
    expect(parseRuleEntry('  ').kind).toBe('invalid');
    expect(parseRuleEntry('!!x').kind).toBe('invalid');
    expect(parseRuleEntry('category:1abc').kind).toBe('invalid');
    expect(parseRuleEntry('category:').kind).toBe('invalid');
  });

  it('round-trips through formatRuleEntry', () =>
  {
    for (const text of ['**/*.log', 'category:lint', '!**/*.log', '!category:lint'])
    {
      expect(formatRuleEntry(parseEntryOrThrow(text))).toBe(text);
    }
  });
});

describe('mergeRuleEntryLists', () =>
{
  it('appends new entries once and applies removals in order', () =>
  {
    const base = ['category:lint', '**/*.log', 'category:ci'].map(parseEntryOrThrow);
    const additions = ['!**/*.log', 'category:lint', '**/*.tmp', '!category:ci'].map(parseEntryOrThrow);
    const merged = mergeRuleEntryLists(base, additions).map(formatRuleEntry);
    expect(merged).toEqual(['category:lint', '!**/*.log', '**/*.tmp', '!category:ci']);
  });

  it('lets a later addition restore a removed entry', () =>
  {
    const base = ['**/*.log'].map(parseEntryOrThrow);
    const additions = ['!**/*.log', '**/*.log'].map(parseEntryOrThrow);
    expect(mergeRuleEntryLists(base, additions).map(formatRuleEntry)).toEqual(['!**/*.log', '**/*.log']);
  });
});
