// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { detect } from 'package-manager-detector';

import { getProjectRoot } from '../common';

export const getPackageManagerInfo = async () => {
  const packageManagerType = await detect({ cwd: getProjectRoot() });

  if (!packageManagerType) {
    return undefined;
  }

  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  let nodeLinker: 'node_modules' | 'pnp' | 'pnpm' | 'isolated' | 'hoisted' = 'node_modules';

  if (packageManagerType.name === 'yarn') {
    try {
      const { stdout } = await execaCommand('yarn config get nodeLinker', {
        cwd: getProjectRoot(),
      });
      nodeLinker = stdout.trim() as 'node_modules' | 'pnp' | 'pnpm';
    } catch (e) {}
  }

  if (packageManagerType.name === 'pnpm') {
    try {
      const { stdout } = await execaCommand('pnpm config get nodeLinker', {
        cwd: getProjectRoot(),
      });
      nodeLinker = (stdout.trim() as 'isolated' | 'hoisted' | 'pnpm') ?? 'isolated';
    } catch (e) {}
  }

  return {
    type: packageManagerType.name,
    version: packageManagerType.version,
    agent: packageManagerType.agent,
    nodeLinker,
  };
};
