// `pnpm run` passes the monorepo's config to the script as `npm_config_*` variables, and package
// managers spawned from it read them ahead of the target project's `.npmrc`. Storybook detects the
// package manager from the user agent.
export function dropInheritedPnpmConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.npm_config_user_agent?.startsWith('pnpm/')) {
    return;
  }

  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_config_') && key !== 'npm_config_user_agent') {
      delete env[key];
    }
  }
}
