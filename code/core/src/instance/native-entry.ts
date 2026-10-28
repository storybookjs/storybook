import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { logger } from '@storybook/core/internal/node-logger';

import * as pkg from 'empathic/package';
import { isAbsolute, resolve } from 'pathe';

import { importModule, safeResolveModule } from '../utils/module.ts';
import {
  PLUGIN_FACTORY,
  type BuilderPlugin,
  type FrameworkPlugin,
  type PluginMeta,
  type RendererPlugin,
  type StorybookPlugin,
} from './plugins.ts';

/** Preset subpaths official packages exported before `<pkg>/node`; group 1 is the package name. */
const OFFICIAL_PRESET_SPECIFIERS: RegExp[] = [
  /^(@storybook\/[^/]+)\/preset(?:-[\w-]+)?(?:\.js)?$/,
  /^(@storybook\/[^/]+)\/server\/framework-preset-[\w-]+(?:\.js)?$/,
  /^(storybook-addon-pseudo-states)\/preset(?:\.js)?$/,
];

const WARNED_SPECIFIERS = new Set<string>();

/** The plugin a native factory of one kind creates. */
export type NativePlugin<K extends PluginMeta['kind']> = K extends 'framework'
  ? FrameworkPlugin
  : K extends 'builder'
    ? BuilderPlugin
    : K extends 'renderer'
      ? RendererPlugin
      : StorybookPlugin;

/**
 * Load the factory a package exports by default from `<pkg>/node` when it is branded for `kind`.
 * `name` is a package name, an absolute or config-relative path inside the package, or a `file:`
 * URL.
 */
export async function resolveNativeFactory<K extends PluginMeta['kind']>(
  name: string,
  kind: K,
  configDir: string
): Promise<((options: unknown) => NativePlugin<K>) | undefined> {
  const entry = resolveNodeEntry(name.startsWith('file:') ? fileURLToPath(name) : name, configDir);
  const factory = entry && (await importModule(entry));
  return typeof factory === 'function' &&
    (factory as { [PLUGIN_FACTORY]?: unknown })[PLUGIN_FACTORY] === kind
    ? factory
    : undefined;
}

/**
 * Map a preset entry an official package used to export to the package name, so `<pkg>/node` loads
 * instead; any other name is returned unchanged.
 *
 * @example
 *
 * ```ts
 * toNativeEntryName('@storybook/react/preset'); // '@storybook/react'
 * toNativeEntryName('@storybook/angular/server/framework-preset-angular-cli'); // '@storybook/angular'
 * toNativeEntryName('storybook-addon-designs/preset'); // unchanged
 * ```
 */
export function toNativeEntryName(name: string): string {
  for (const pattern of OFFICIAL_PRESET_SPECIFIERS) {
    const packageName = pattern.exec(name)?.[1];
    if (packageName) {
      return packageName;
    }
  }
  return name;
}

function resolveNodeEntry(name: string, configDir: string): string | undefined {
  if (!isAbsolute(name) && !name.startsWith('.')) {
    const packageName = toNativeEntryName(name);
    const entry = safeResolveModule({ specifier: `${packageName}/node`, parent: configDir });
    // Packages that still ship their preset keep loading it without a warning.
    if (entry && packageName !== name && !WARNED_SPECIFIERS.has(name)) {
      WARNED_SPECIFIERS.add(name);
      logger.warn(
        `"${name}" is deprecated and will be removed in Storybook 12. Use "${packageName}" instead.`
      );
    }
    return entry;
  }
  const packageJson = pkg.up({ cwd: resolve(configDir, name) });
  const manifest = packageJson && JSON.parse(readFileSync(packageJson, 'utf8'));
  // Only a declared `./node` export counts, so a path inside a project never imports its package.
  return typeof manifest?.name === 'string' && manifest.exports?.['./node']
    ? safeResolveModule({ specifier: `${manifest.name}/node`, parent: packageJson })
    : undefined;
}
