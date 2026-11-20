import type { PluginOption } from 'vite';

export function withoutKitSsrMiddleware(plugin: PluginOption): PluginOption {
  if (Array.isArray(plugin)) {
    return plugin.map(withoutKitSsrMiddleware);
  }
  // This Kit plugin starts the file watchers and returns the app's SSR post-hook.
  // https://github.com/sveltejs/kit/blob/879c2c0aed2652189ebcaf2ac751ae1220cf63dc/packages/kit/src/exports/vite/index.js
  if (
    !plugin ||
    !('configureServer' in plugin) ||
    plugin.name !== 'vite-plugin-sveltekit-setup' ||
    !plugin.configureServer
  ) {
    return plugin;
  }

  const hook =
    typeof plugin.configureServer === 'function'
      ? { handler: plugin.configureServer }
      : plugin.configureServer;
  // Omitting Kit's SSR post-hook keeps Vite's static and public middleware in place.
  // https://github.com/sveltejs/kit/blob/879c2c0aed2652189ebcaf2ac751ae1220cf63dc/packages/kit/src/exports/vite/dev/index.js
  return {
    ...plugin,
    configureServer: {
      ...hook,
      async handler(server) {
        await hook.handler.call(this, server);
      },
    },
  };
}
