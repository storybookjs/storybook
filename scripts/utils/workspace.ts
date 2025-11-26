import path from 'node:path';

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
  const { stdout } = await execaCommand(
    `yarn workspaces list --json ${includePrivate ? '' : '--no-private'}`,
    {
      cwd: ROOT_DIRECTORY,
      shell: true,
    }
  );
  return (JSON.parse(`[${stdout.split('\n').join(',')}]`) as Workspace[])
    .filter(({ name }: any) => name !== '@storybook/root' && name !== '@storybook/scripts')
    .map((it) => {
      return {
        name: it.name,
        // strip code from the location for backwards compatibility
        location: it.location === 'code' ? '.' : it.location.replace('code/', ''),
      };
    }) as Workspace[];
}

const getWorkspacesMemo = memoize(1)(getCodeWorkspaces);

export async function workspacePath(type: string, packageName: string) {
  const workspaces = await getWorkspacesMemo();
  const workspace = workspaces.find((w) => w.name === packageName);
  if (!workspace) {
    throw new Error(`Unknown ${type} '${packageName}', not in yarn workspace!`);
  }
  return workspace.location;
}
