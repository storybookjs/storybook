import { relative, sep } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import memoize from 'memoizerific';

import { ROOT_DIRECTORY } from './constants.ts';

export type Workspace = { name: string; location: string };

type PnpmProject = { name: string; path: string; private?: boolean };

/**
 * Get the list of workspaces in the monorepo, excluding the scripts and code packages. And relative
 * to the code directory.
 */
export async function getCodeWorkspaces(includePrivate = true) {
  const { stdout } = await execaCommand('pnpm m ls --json --depth -1', {
    cwd: ROOT_DIRECTORY,
    shell: true,
  });
  return (JSON.parse(stdout) as PnpmProject[])
    .filter((it) => includePrivate || !it.private)
    .filter(({ name }) => name !== '@storybook/root' && name !== '@storybook/scripts')
    .map((it) => {
      const location = relative(ROOT_DIRECTORY, it.path).split(sep).join('/');
      return {
        name: it.name,
        // strip code from the location for backwards compatibility; workspaces
        // outside code/ (e.g. agent-eval) resolve via a parent-relative path so
        // callers can keep joining locations onto the code directory
        location:
          location === 'code'
            ? '.'
            : location.startsWith('code/')
              ? location.replace('code/', '')
              : `../${location}`,
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
