import { findNodeAtLocation, parseTree, type Node, type ParseError } from 'jsonc-parser';

const excludeSettingKey = 'files.exclude';

export interface StripManagedKeysOptions
{
  readonly managedKeys: readonly string[];
  /** Remove the whole `files.exclude` property when no key remains after the strip. */
  readonly removeExcludePropertyWhenEmpty: boolean;
}

/**
 * Removes the managed keys from the `files.exclude` object of a settings file with comments.
 * Everything else, including comments and formatting, stays as it is. Invalid JSON is returned unchanged.
 */
export function stripManagedKeysFromSettings(settingsText: string, options: StripManagedKeysOptions): string
{
  const parseErrors: ParseError[] = [];
  const rootNode = parseTree(settingsText, parseErrors, { allowTrailingComma: true });
  if (rootNode === undefined || parseErrors.length > 0 || rootNode.type !== 'object')
  {
    return settingsText;
  }
  const excludeNode = findNodeAtLocation(rootNode, [excludeSettingKey]);
  if (excludeNode?.type !== 'object' || excludeNode.parent === undefined)
  {
    return settingsText;
  }
  const properties = excludeNode.children ?? [];
  const managedKeySet = new Set(options.managedKeys);
  const indexesToRemove = properties.flatMap((propertyNode, index) =>
    (managedKeySet.has(readPropertyKey(propertyNode) ?? '') ? [index] : []));
  if (indexesToRemove.length === 0)
  {
    return settingsText;
  }
  if (indexesToRemove.length === properties.length && options.removeExcludePropertyWhenEmpty)
  {
    const rootProperties = rootNode.children ?? [];
    const excludePropertyIndex = rootProperties.indexOf(excludeNode.parent);
    return removeProperty(settingsText, rootProperties, excludePropertyIndex);
  }
  let strippedText = settingsText;
  for (const index of [...indexesToRemove].reverse())
  {
    const currentProperties = findExcludeProperties(strippedText);
    strippedText = removeProperty(strippedText, currentProperties, index);
  }
  return strippedText;
}

function findExcludeProperties(text: string): readonly Node[]
{
  const rootNode = parseTree(text, [], { allowTrailingComma: true });
  if (rootNode === undefined)
  {
    return [];
  }
  return findNodeAtLocation(rootNode, [excludeSettingKey])?.children ?? [];
}

function readPropertyKey(propertyNode: Node): string | undefined
{
  const keyNode = propertyNode.children?.[0];
  return keyNode?.type === 'string' && typeof keyNode.value === 'string' ? keyNode.value : undefined;
}

function removeProperty(text: string, properties: readonly Node[], index: number): string
{
  const propertyNode = properties[index];
  if (propertyNode === undefined)
  {
    return text;
  }
  const previousNode = properties[index - 1];
  const hasNext = index < properties.length - 1;
  let start = propertyNode.offset;
  let end = propertyNode.offset + propertyNode.length;
  end = skipInlineWhitespace(text, end);
  if (text[end] === ',')
  {
    end += 1;
  }
  end = skipInlineWhitespace(text, end);
  if (text.startsWith('//', end))
  {
    end = findLineEnd(text, end);
  }
  const lineStart = findLineStart(text, start);
  const ownsWholeLine = text.slice(lineStart, start).trim().length === 0;
  if (ownsWholeLine)
  {
    start = lineStart;
    end = skipLineBreak(text, end);
  }
  let strippedText = text.slice(0, start) + text.slice(end);
  if (!hasNext && previousNode !== undefined)
  {
    const previousEnd = previousNode.offset + previousNode.length;
    const commaOffset = findCommaOffset(strippedText, previousEnd);
    if (commaOffset !== undefined)
    {
      strippedText = strippedText.slice(0, commaOffset) + strippedText.slice(commaOffset + 1);
    }
  }
  return strippedText;
}

function findCommaOffset(text: string, fromOffset: number): number | undefined
{
  let position = fromOffset;
  while (position < text.length)
  {
    const character = text[position];
    if (character === ',')
    {
      return position;
    }
    if (character === ' ' || character === '\t' || character === '\n' || character === '\r')
    {
      position += 1;
      continue;
    }
    if (text.startsWith('//', position))
    {
      position = findLineEnd(text, position);
      continue;
    }
    if (text.startsWith('/*', position))
    {
      const commentEnd = text.indexOf('*/', position + 2);
      if (commentEnd < 0)
      {
        return undefined;
      }
      position = commentEnd + 2;
      continue;
    }
    return undefined;
  }
  return undefined;
}

function skipInlineWhitespace(text: string, offset: number): number
{
  let position = offset;
  while (text[position] === ' ' || text[position] === '\t')
  {
    position += 1;
  }
  return position;
}

function skipLineBreak(text: string, offset: number): number
{
  if (text.startsWith('\r\n', offset))
  {
    return offset + 2;
  }
  if (text[offset] === '\n' || text[offset] === '\r')
  {
    return offset + 1;
  }
  return offset;
}

function findLineEnd(text: string, offset: number): number
{
  const newlineIndex = text.indexOf('\n', offset);
  if (newlineIndex < 0)
  {
    return text.length;
  }
  return text[newlineIndex - 1] === '\r' ? newlineIndex - 1 : newlineIndex;
}

function findLineStart(text: string, offset: number): number
{
  const newlineIndex = text.lastIndexOf('\n', offset - 1);
  return newlineIndex < 0 ? 0 : newlineIndex + 1;
}
