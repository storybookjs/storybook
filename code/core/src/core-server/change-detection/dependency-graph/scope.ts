const NODE_MODULES_SEGMENT = '/node_modules/';

export function isInsideAnyWorkspace(absolute: string, workspaceRoots: Set<string>): boolean {
  if (absolute.includes(NODE_MODULES_SEGMENT)) {
    return false;
  }
  for (const root of workspaceRoots) {
    if (absolute === root || absolute.startsWith(root.endsWith('/') ? root : `${root}/`)) {
      return true;
    }
  }
  return false;
}

export function isInScope(
  absolute: string,
  projectRoot: string,
  workspaceRoots: Set<string>
): boolean {
  const projectPrefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
  if (
    (absolute === projectRoot || absolute.startsWith(projectPrefix)) &&
    !absolute.includes(NODE_MODULES_SEGMENT)
  ) {
    return true;
  }
  return isInsideAnyWorkspace(absolute, workspaceRoots);
}
