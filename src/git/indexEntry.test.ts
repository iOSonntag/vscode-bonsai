import { describe, expect, it } from 'vitest';
import { parseStageZeroIndexEntry } from './indexEntry.js';

describe('parseStageZeroIndexEntry', () =>
{
  it('parses a single stage zero entry', () =>
  {
    const output = '100644 cb7b13084fb78bc278c224771d5d34fc0a2187d7 0\t.vscode/settings.json\n';
    expect(parseStageZeroIndexEntry(output)).toEqual({
      mode: '100644',
      objectId: 'cb7b13084fb78bc278c224771d5d34fc0a2187d7',
    });
  });

  it('rejects an untracked path, a conflict, and a non-zero stage', () =>
  {
    expect(parseStageZeroIndexEntry('')).toBeUndefined();
    const conflict = '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1\tx\n100644 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 2\tx\n';
    expect(parseStageZeroIndexEntry(conflict)).toBeUndefined();
    expect(parseStageZeroIndexEntry('100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1\tx\n')).toBeUndefined();
  });
});
