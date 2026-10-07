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

/** True when the path lies strictly below the folder. The folder itself is not below itself. */
export function isPathBelowFolder(relativePath: string, folderPath: string): boolean
{
  const pathSegments = splitRelativePath(relativePath);
  const folderSegments = splitRelativePath(folderPath);
  if (pathSegments.length <= folderSegments.length)
  {
    return false;
  }
  return folderSegments.every((folderSegment, index) => pathSegments[index] === folderSegment);
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
