/**
 * `pnpm run` exports its whole resolved configuration to the script as `npm_config_*` environment
 * variables; Yarn exports only `npm_config_user_agent`. Those values describe this monorepo, yet
 * every package manager the script spawns reads them ahead of the target project's own `.npmrc`. A
 * leaked `npm_config_registry`, for instance, sends sandbox installs to npmjs instead of the local
 * registry, and npm scaffolds and `npm config set -g` would target pnpm's config.
 *
 * Remove them, so the projects we create are configured only by their own files. The user agent
 * stays: Storybook reads it to detect the package manager.
 */
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
