import { describe, expect, it } from 'vitest';
import { stripManagedKeysFromSettings } from './stripManagedKeys.js';

const settingsWithComments = `{
  // Editor
  "editor.tabSize": 2,
  "files.exclude": {
    "**/.git": true, // keep me
    "src/legacy": true,
    "dist/**/*.log": true
  },
  "search.exclude": {}
}
`;

describe('stripManagedKeysFromSettings', () =>
{
  it('removes only the managed keys and keeps comments and formatting', () =>
  {
    const result = stripManagedKeysFromSettings(settingsWithComments, {
      managedKeys: ['src/legacy', 'dist/**/*.log', 'not-present'],
      removeExcludePropertyWhenEmpty: false,
    });
    expect(result).toBe(`{
  // Editor
  "editor.tabSize": 2,
  "files.exclude": {
    "**/.git": true // keep me
  },
  "search.exclude": {}
}
`);
  });

  it('removes the whole property when it becomes empty and Bonsai created it', () =>
  {
    const text = `{\n  "editor.tabSize": 2,\n  "files.exclude": {\n    "src/legacy": true\n  }\n}\n`;
    const result = stripManagedKeysFromSettings(text, {
      managedKeys: ['src/legacy'],
      removeExcludePropertyWhenEmpty: true,
    });
    expect(result).toBe('{\n  "editor.tabSize": 2\n}\n');
  });

  it('keeps an empty object when Bonsai did not create the property', () =>
  {
    const text = `{\n  "files.exclude": {\n    "src/legacy": true\n  }\n}\n`;
    const result = stripManagedKeysFromSettings(text, {
      managedKeys: ['src/legacy'],
      removeExcludePropertyWhenEmpty: false,
    });
    expect(result).toBe('{\n  "files.exclude": {\n  }\n}\n');
  });

  it('removes a middle key and a last key from a single-line object', () =>
  {
    const text = '{ "files.exclude": { "a": true, "b": true, "c": true } }';
    const result = stripManagedKeysFromSettings(text, { managedKeys: ['b', 'c'], removeExcludePropertyWhenEmpty: false });
    expect(result).toBe('{ "files.exclude": { "a": true } }');
  });

  it('keeps a trailing comment of the previous property when it removes the last property', () =>
  {
    const text = '{\n  "files.exclude": {\n    "**/.git": true, // keep me\n    "src/legacy": true\n  }\n}\n';
    const result = stripManagedKeysFromSettings(text, { managedKeys: ['src/legacy'], removeExcludePropertyWhenEmpty: false });
    expect(result).toBe('{\n  "files.exclude": {\n    "**/.git": true // keep me\n  }\n}\n');
  });

  it('returns the text unchanged when nothing matches, when the setting is missing, or when the JSON is invalid', () =>
  {
    const options = { managedKeys: ['x'], removeExcludePropertyWhenEmpty: true };
    expect(stripManagedKeysFromSettings(settingsWithComments, options)).toBe(settingsWithComments);
    expect(stripManagedKeysFromSettings('{ "a": 1 }', options)).toBe('{ "a": 1 }');
    expect(stripManagedKeysFromSettings('{ "files.exclude": { "x": true ', options)).toBe('{ "files.exclude": { "x": true ');
  });
});
