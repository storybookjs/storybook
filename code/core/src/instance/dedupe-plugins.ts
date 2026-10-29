import { isDeepStrictEqual } from 'node:util';

import { logger } from '@storybook/core/internal/node-logger';

import { PLUGIN_OPTIONS, type LegacyPreset, type StorybookPlugin } from './plugins.ts';

/**
 * Keep one plugin per `meta.kind` and `meta.name` at its first position: a later entry with options replaces an
 * earlier one without, and differing options keep the first with a warning.
 */
export function dedupePlugins<T extends StorybookPlugin>(plugins: readonly T[]): T[] {
  const positions = new Map<string, number>();
  const kept: T[] = [];
  for (const plugin of plugins) {
    const { name } = plugin.meta;
    // A framework may name its renderer after itself.
    const key = `${plugin.meta.kind}:${name}`;
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, kept.length);
      kept.push(plugin);
      continue;
    }
    const first = getPluginOptions(kept[position]);
    const options = getPluginOptions(plugin);
    if (options === undefined || isDeepStrictEqual(first, options)) {
      continue;
    }
    if (first === undefined) {
      kept[position] = plugin;
    } else {
      logger.warn(
        `"${name}" is configured more than once with different options; using the first.`
      );
    }
  }
  return kept;
}

function getPluginOptions(plugin: StorybookPlugin): unknown {
  if ('legacy' in plugin) {
    const { legacy } = plugin as LegacyPreset;
    return typeof legacy === 'string' ? undefined : legacy.options;
  }
  return (plugin as { [PLUGIN_OPTIONS]?: unknown })[PLUGIN_OPTIONS];
}
