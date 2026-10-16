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

export const isTanStackStartPlugin = (p: unknown): boolean =>
  matchesPluginName(p, (name) => name.startsWith('tanstack-start') || name.includes('rsc:'));

export const isCloudflareVitePlugin = (p: unknown): boolean =>
  matchesPluginName(
    p,
    (name) => name === 'vite-plugin-cloudflare' || name.startsWith('vite-plugin-cloudflare:')
  );
