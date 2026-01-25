// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import memoize from 'memoizerific';

import { ROOT_DIRECTORY } from './constants';

export type Workspace = { name: string; location: string };

/**
 * Get the list of workspaces in the monorepo, excluding the scripts and code packages. And relative
 * to the code directory.
 */
export async function getCodeWorkspaces(includePrivate = true) {
  const { stdout } = await execaCommand(`pnpm ls -r --json --depth=-1`, {
    cwd: ROOT_DIRECTORY,
    shell: true,
  });
  const workspaces = JSON.parse(stdout) as Array<{
    name: string;
    path: string;
    private?: boolean;
  }>;
  return workspaces
    .filter((pkg) => pkg.name !== '@storybook/root' && pkg.name !== '@storybook/scripts')
    .filter((pkg) => includePrivate || !pkg.private)
    .map((pkg) => {
      // Convert absolute path to relative location from code directory
      const relativePath = pkg.path.replace(ROOT_DIRECTORY + '/', '');
      return {
        name: pkg.name,
        // strip code from the location for backwards compatibility
        location: relativePath === 'code' ? '.' : relativePath.replace('code/', ''),
      };
    }) as Workspace[];
}

const getWorkspacesMemo = memoize(1)(getCodeWorkspaces);

export async function workspacePath(type: string, packageName: string) {
  const workspaces = await getWorkspacesMemo();
  const workspace = workspaces.find((w) => w.name === packageName);
  if (!workspace) {
    throw new Error(`Unknown ${type} '${packageName}', not in pnpm workspace!`);
  }
  return workspace.location;
}
