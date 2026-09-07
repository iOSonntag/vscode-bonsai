/** Splits a workspace-relative path into its segments. The root path is the empty string and has no segments. */
export function splitRelativePath(relativePath: string): string[]
{
  const normalizedPath = relativePath.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (normalizedPath.length === 0)
  {
    return [];
  }
  return normalizedPath.split('/').filter((segment) => segment.length > 0);
}

/** Joins path segments with a forward slash. No segments yield the root path, the empty string. */
export function joinPathSegments(segments: readonly string[]): string
{
  return segments.join('/');
}

/** Appends one child name to a workspace-relative path. */
export function appendPathSegment(relativePath: string, childName: string): string
{
  if (relativePath.length === 0)
  {
    return childName;
  }
  return `${relativePath}/${childName}`;
}
