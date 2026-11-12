// pathe's delimiter is always ':', which would split Windows paths at the drive letter.
import { delimiter } from 'node:path';

const PNPM_VIRTUAL_STORE = /[\\/]node_modules[\\/]\.pnpm(?:[\\/]|$)/;

// `pnpm run` passes the monorepo's config to the script as `npm_config_*` variables, and package
// managers spawned from it read them ahead of the target project's `.npmrc`. pnpm's bin shims also
// put the monorepo's virtual store on `NODE_PATH`. Storybook detects the package manager from the
// user agent.
export function dropInheritedPnpmConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.npm_config_user_agent?.startsWith('pnpm/')) {
    return;
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_config_') && key !== 'npm_config_user_agent') {
      delete env[key];
    }
  }

  const nodePath = env.NODE_PATH?.split(delimiter).filter(
    (entry) => entry && !PNPM_VIRTUAL_STORE.test(entry)
  );
  if (nodePath?.length) {
    env.NODE_PATH = nodePath.join(delimiter);
  } else {
    delete env.NODE_PATH;
  }
}
