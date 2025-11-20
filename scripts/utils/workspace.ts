// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import memoize from 'memoizerific';

import { ROOT_DIRECTORY } from './constants';

export type Workspace = { name: string; location: string };

export async function getWorkspaces(includePrivate = true) {
  const { stdout } = await execaCommand(
    `yarn workspaces list --json ${includePrivate ? '' : '--no-private'}`,
    {
      cwd: ROOT_DIRECTORY,
      shell: true,
    }
  );
  return JSON.parse(`[${stdout.split('\n').join(',')}]`).filter(
    ({ name }: any) => name !== '@storybook/scripts' && name !== '@storybook/super-root'
  ) as Workspace[];
}

const getWorkspacesMemo = memoize(1)(getWorkspaces);

export async function workspacePath(type: string, packageName: string) {
  const workspaces = await getWorkspacesMemo();
  const workspace = workspaces.find((w) => w.name === packageName);
  if (!workspace) {
    throw new Error(`Unknown ${type} '${packageName}', not in yarn workspace!`);
  }
  return workspace.location;
}
