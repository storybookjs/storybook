/** Recursively removes all plugins with the names given Resolves async plugins */
export const withoutVitePlugins = async <TPlugin>(
  plugins: TPlugin[] = [],
  namesToRemove: string[]
): Promise<TPlugin[]> => {
  const result: TPlugin[] = [];
  const resolvedPlugins = await Promise.all(plugins);

  for (const plugin of resolvedPlugins) {
    if (Array.isArray(plugin)) {
      result.push(await (withoutVitePlugins(plugin, namesToRemove) as any));
    } else if (
      plugin &&
      typeof plugin === 'object' &&
      'name' in plugin &&
      typeof plugin.name === 'string' &&
      !namesToRemove.includes(plugin.name)
    ) {
      result.push(plugin);
    }
  }
  return result;
};
