/**
 * Predicates for user-supplied Vite plugins that are incompatible with Storybook and are removed
 * from the Vite config that Storybook inherits from the user's project.
 */
const matchesPluginName = (p: unknown, matches: (name: string) => boolean): boolean => {
  if (Array.isArray(p)) {
    return p.some((entry) => matchesPluginName(entry, matches));
  }
  const pluginRecord = p as Record<string, unknown>;
  return (
    typeof p === 'object' &&
    p !== null &&
    'name' in pluginRecord &&
    typeof pluginRecord.name === 'string' &&
    matches(pluginRecord.name)
  );
};

/**
 * TanStack Start Vite plugins are removed from the user's Vite config as a workaround for
 * compatibility issues.
 *
 * This follows the pattern discussed at: https://github.com/storybookjs/storybook/issues/33754
 */
export const isTanStackStartPlugin = (p: unknown): boolean =>
  matchesPluginName(p, (name) => name.startsWith('tanstack-start') || name.includes('rsc:'));

/**
 * The Cloudflare Vite plugin (`@cloudflare/vite-plugin`) boots the user's Worker inside workerd
 * and evaluates the `virtual:cloudflare/worker-entry` module in that runtime. Storybook's module
 * interception resolves that entry to its TanStack Start mock, which imports `storybook/test` — a
 * module the Vite builder rewrites to a global (`__STORYBOOK_MODULE_TEST__`) that only exists in
 * the browser preview. The Worker runtime then crashes on startup with `ReferenceError:
 * __STORYBOOK_MODULE_TEST__ is not defined`. Storybook never needs the Worker runtime (all Start
 * server modules are mocked), so the plugin is removed entirely.
 *
 * `@cloudflare/vite-plugin` registers a main plugin named `vite-plugin-cloudflare` and
 * sub-plugins named `vite-plugin-cloudflare:<name>`.
 *
 * See: https://github.com/storybookjs/storybook/issues/35704
 */
export const isCloudflareVitePlugin = (p: unknown): boolean =>
  matchesPluginName(
    p,
    (name) => name === 'vite-plugin-cloudflare' || name.startsWith('vite-plugin-cloudflare:')
  );
