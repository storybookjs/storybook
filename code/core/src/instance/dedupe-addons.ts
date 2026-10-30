import { isDeepStrictEqual } from 'node:util';

import { logger } from '@storybook/core/internal/node-logger';

import { ADDON_OPTIONS, type LegacyPreset, type StorybookAddon } from './addons.ts';

/**
 * Keep one addon per `meta.kind` and `meta.name` at its first position: a later entry with options replaces an
 * earlier one without, and differing options keep the first with a warning.
 */
export function dedupeAddons<T extends StorybookAddon>(addons: readonly T[]): T[] {
  const positions = new Map<string, number>();
  const kept: T[] = [];
  for (const addon of addons) {
    const { name } = addon.meta;
    // A framework may name its renderer after itself.
    const key = `${addon.meta.kind}:${name}`;
    const position = positions.get(key);
    if (position === undefined) {
      positions.set(key, kept.length);
      kept.push(addon);
      continue;
    }
    const first = getAddonOptions(kept[position]);
    const options = getAddonOptions(addon);
    if (options === undefined || isDeepStrictEqual(first, options)) {
      continue;
    }
    if (first === undefined) {
      kept[position] = addon;
    } else {
      logger.warn(
        `"${name}" is configured more than once with different options; using the first.`
      );
    }
  }
  return kept;
}

function getAddonOptions(addon: StorybookAddon): unknown {
  if ('legacy' in addon) {
    const { legacy } = addon as LegacyPreset;
    return typeof legacy === 'string' ? undefined : legacy.options;
  }
  return (addon as { [ADDON_OPTIONS]?: unknown })[ADDON_OPTIONS];
}
