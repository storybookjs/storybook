import type { PluginOption } from 'vite';

/** Recursively removes all plugins with the names given Resolves async plugins */
export const withoutVitePlugins = async (
  plugins: PluginOption[] = [],
  namesToRemove: string[]
): Promise<PluginOption[]> => {
  const result = [];
  const resolvedPlugins = await Promise.all(plugins);

  for (const plugin of resolvedPlugins) {
    if (Array.isArray(plugin)) {
      result.push(await withoutVitePlugins(plugin, namesToRemove));
    }
    if (plugin && 'name' in plugin && !namesToRemove.includes(plugin.name)) {
      result.push(plugin);
    }
  }
  return result;
};
