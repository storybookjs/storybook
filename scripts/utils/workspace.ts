// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import memoize from 'memoizerific';

import { CODE_DIRECTORY } from './constants';

export type Workspace = { name: string; location: string };

export async function getWorkspaces(includePrivate = true) {
  const { stdout } = await execaCommand(
    `yarn workspaces list --json ${includePrivate ? '' : '--no-private'}`,
    {
      cwd: CODE_DIRECTORY,
      shell: true,
    }
  );
  return JSON.parse(`[${stdout.split('\n').join(',')}]`) as Workspace[];
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
