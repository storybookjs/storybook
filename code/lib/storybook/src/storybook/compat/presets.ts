import {
  getInterpretedFile,
  validateConfigurationFiles,
  type InterPresetOptions,
} from '@storybook/core/internal/common';
import type { ChannelLike } from '@storybook/core/internal/channels';
import { importModule, safeResolveModule } from '@storybook/core/internal/deep/utils/module';
import { internal_defineLegacyFieldOptions } from '@storybook/core/internal/instance';
import { logger } from '@storybook/core/internal/node-logger';
import { CriticalPresetLoadError } from '@storybook/core/internal/server-errors';
import type {
  BuilderOptions,
  CLIOptions,
  CoreCommon_ResolvedAddonPreset,
  CoreCommon_ResolvedAddonVirtual,
  LoadOptions,
  LoadedPreset,
  PresetConfig,
  Presets,
  StorybookConfig,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import { readFileSync } from 'node:fs';

import { isAbsolute, join, parse, resolve } from 'pathe';
import { dedent } from '@storybook/core/internal/deep/utils/node-libs';

import { stripAbsNodeModulesPath } from './strip-abs-node-modules-path.ts';

/**
 * Turn a preset or addon entry nested in another preset into an instance plugin's virtual preset.
 * `undefined` keeps loading it as a preset; `null` drops it because that plugin is already set up.
 */
export type NativePresetResolver = (
  entry: PresetConfig
) => Promise<PresetConfig | null | undefined>;

const isObject = (val: unknown): val is Record<string, any> =>
  val != null && typeof val === 'object' && Array.isArray(val) === false;
const isFunction = (val: unknown): val is Function => typeof val === 'function';

export function filterPresetsConfig(presetsConfig: PresetConfig[]): PresetConfig[] {
  return presetsConfig.filter((preset) => {
    const presetName = typeof preset === 'string' ? preset : preset.name;
    return !/@storybook[\\\\/]preset-typescript/.test(presetName);
  });
}

function resolvePresetFunction<T = any>(
  input: T[] | Function,
  presetOptions: any,
  storybookOptions: InterPresetOptions
): T[] {
  if (isFunction(input)) {
    return [...input({ ...storybookOptions, ...presetOptions })];
  }
  if (Array.isArray(input)) {
    return [...input];
  }

  return [];
}

function readAddonManifest(dir: string): { name?: string; exports?: unknown } | undefined {
  try {
    const { name, exports } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    return { name: typeof name === 'string' && name !== '' ? name : undefined, exports };
  } catch {
    return undefined;
  }
}

/**
 * Parse an addon into either a managerEntries or a preset. Throw on invalid input.
 *
 * Valid inputs:
 *
 * - `'storybook-addon-designs/preset' => { type: 'presets', item }`
 * - `'storybook-addon-designs' => { type: 'presets', item: 'storybook-addon-designs/preset' }`
 * - `{ name: 'storybook-addon-designs(/preset)?', options: { } } => { type: 'presets', item: { name:
 *   'storybook-addon-designs/preset', options } }`
 *
 * Official packages have no preset entry; the instance loads their `<pkg>/node` plugin instead.
 */
export const resolveAddonName = (
  configDir: string,
  name: string,
  options: any
): CoreCommon_ResolvedAddonPreset | CoreCommon_ResolvedAddonVirtual | undefined => {
  const resolved = safeResolveModule({ specifier: name, parent: configDir });

  if (resolved && parse(name).name === 'preset') {
    return {
      type: 'presets',
      name: resolved,
    };
  }

  // An absolute `name` is a directory, so joining entry subpaths onto it bypasses the
  // package's `exports` map. Resolving the bare specifier from the package's own directory
  // consults `exports` instead, and restricting that to packages which declare `exports`
  // keeps the lookup from walking node_modules into a different copy of the addon.
  const manifest = isAbsolute(name) ? readAddonManifest(name) : undefined;
  const exportsSpecifier = manifest?.exports ? manifest.name : undefined;

  const resolveEntryFile = (entry: string) =>
    (exportsSpecifier
      ? safeResolveModule({ specifier: `${exportsSpecifier}/${entry}`, parent: name })
      : undefined) ?? safeResolveModule({ specifier: join(name, entry), parent: configDir });

  const presetFile = resolveEntryFile('preset');
  const managerFile = resolveEntryFile('manager');
  const previewFile = resolveEntryFile('preview');

  if (managerFile || previewFile || presetFile) {
    const previewAnnotations = [];
    if (previewFile) {
      const parsedPreviewFile = stripAbsNodeModulesPath(previewFile);
      if (parsedPreviewFile !== previewFile) {
        previewAnnotations.push({
          bare: parsedPreviewFile,
          absolute: previewFile,
        });
      } else {
        previewAnnotations.push(previewFile);
      }
    }
    return {
      type: 'virtual',
      name,
      presets: presetFile ? [{ name: presetFile, options }] : [],
      managerEntries: managerFile ? [managerFile] : [],
      previewAnnotations,
    };
  }

  if (resolved) {
    return {
      type: 'presets',
      name: resolved,
    };
  }

  return undefined;
};

const map =
  ({ configDir }: InterPresetOptions) =>
  (item: any) => {
    const options = isObject(item) ? item['options'] || undefined : undefined;
    const name = isObject(item) ? item['name'] : item;

    let resolved;

    try {
      resolved = resolveAddonName(configDir, name, options);
    } catch (err) {
      logger.error(
        `Addon value should end in /manager or /preview or /register OR it should be a valid preset https://storybook.js.org/docs/addons/writing-presets/\n${item}`
      );
      return undefined;
    }

    if (!resolved) {
      const packageName = isAbsolute(name) ? readAddonManifest(name)?.name : undefined;
      logger.warn(
        packageName
          ? dedent`
              Could not resolve addon "${packageName}", skipping.
              It is installed at ${name}, but none of its preset, manager or preview entry points could be resolved.
              If your main config wraps it in getAbsolutePath(), try referencing "${packageName}" directly instead.
            `
          : `Could not resolve addon "${name}", skipping. Is it installed?`
      );
      return undefined;
    }

    return {
      ...(options ? { options } : {}),
      ...resolved,
    };
  };

async function getContent(input: any, configDir: string) {
  if (input.type === 'virtual') {
    const { type, name, ...rest } = input;
    return rest;
  }
  const name = input.name ? input.name : input;

  return importModule(safeResolveModule({ specifier: name, parent: configDir }) ?? name);
}

export async function loadPreset(
  input: PresetConfig,
  level: number,
  storybookOptions: InterPresetOptions,
  resolveNative?: NativePresetResolver
): Promise<LoadedPreset[]> {
  // @ts-expect-error (Converted from ts-ignore)
  const presetName: string = input.name ? input.name : input;

  try {
    // @ts-expect-error (Converted from ts-ignore)
    const presetOptions = input.options ? input.options : {};

    let contents = await getContent(input, storybookOptions.configDir);

    if (typeof contents === 'function') {
      // allow the export of a preset to be a function, that gets storybookOptions
      contents = contents(storybookOptions, presetOptions);
    }

    if (Array.isArray(contents)) {
      const subPresets = await toNativePresets(contents, resolveNative, (entry) => entry);
      return await loadPresets(subPresets, level + 1, storybookOptions, resolveNative);
    }

    if (isObject(contents)) {
      const { addons: addonsInput = [], presets: presetsInput = [], ...rest } = contents;

      let filter = (i: PresetConfig) => {
        return true;
      };

      if (
        storybookOptions.isCritical !== true &&
        (storybookOptions.build?.test?.disabledAddons?.length || 0) > 0
      ) {
        filter = (i: PresetConfig) => {
          // @ts-expect-error (Converted from ts-ignore)
          const name = i.name ? i.name : i;

          return !storybookOptions.build?.test?.disabledAddons?.find((n) => name.includes(n));
        };
      }

      const subPresets = resolvePresetFunction(
        presetsInput,
        presetOptions,
        storybookOptions
      ).filter(filter);
      const subAddons = resolvePresetFunction(addonsInput, presetOptions, storybookOptions).filter(
        filter
      );

      return [
        ...(await loadPresets(
          await toNativePresets(subPresets, resolveNative, (entry) => entry),
          level + 1,
          storybookOptions,
          resolveNative
        )),
        ...(await loadPresets(
          await toNativePresets(subAddons, resolveNative, map(storybookOptions)),
          level + 1,
          storybookOptions,
          resolveNative
        )),
        {
          name: presetName,
          preset: rest,
          options: presetOptions,
        },
      ];
    }

    throw new Error(dedent`
      ${input} is not a valid preset
    `);
  } catch (error: any) {
    if (storybookOptions?.isCritical) {
      throw new CriticalPresetLoadError({
        error,
        presetName,
      });
    }

    const warning =
      level > 0
        ? `  Failed to load preset: ${JSON.stringify(input)} on level ${level}`
        : `  Failed to load preset: ${JSON.stringify(input)}`;

    logger.warn(warning);
    logger.error(error);
    return [];
  }
}

async function loadPresets(
  presets: PresetConfig[],
  level: number,
  storybookOptions: InterPresetOptions,
  resolveNative?: NativePresetResolver
): Promise<LoadedPreset[]> {
  if (!presets || !Array.isArray(presets) || !presets.length) {
    return [];
  }

  // Sequential on purpose: a CJS preset that require()s an ESM module still being import()ed in parallel crashes with ERR_INTERNAL_ASSERTION.
  const loaded: LoadedPreset[] = [];
  for (const preset of presets) {
    loaded.push(...(await loadPreset(preset, level, storybookOptions, resolveNative)));
  }

  return loaded;
}

/** Swap nested entries with a native plugin for its virtual preset; map the rest with `fallback`. */
async function toNativePresets(
  entries: PresetConfig[],
  resolveNative: NativePresetResolver | undefined,
  fallback: (entry: PresetConfig) => PresetConfig | undefined
): Promise<PresetConfig[]> {
  const result: PresetConfig[] = [];
  for (const entry of entries) {
    const native = await resolveNative?.(entry);
    const config = native === undefined ? fallback(entry) : native;
    if (config) {
      result.push(config);
    }
  }
  return result;
}

function applyPresets(
  presets: LoadedPreset[],
  extension: string,
  config: any,
  args: any,
  storybookOptions: InterPresetOptions
): Promise<any> {
  const presetResult = new Promise((res) => res(config));

  if (!presets.length) {
    return presetResult;
  }

  return presets.reduce((accumulationPromise: Promise<unknown>, { preset, options }) => {
    const change = preset[extension];

    if (!change) {
      return accumulationPromise;
    }

    if (typeof change === 'function') {
      const extensionFn = change;
      const context = {
        preset,
        combinedOptions: internal_defineLegacyFieldOptions(
          {
            ...storybookOptions,
            ...args,
            ...options,
            presets: {
              apply: async (ext: string, c: any, a = {}) =>
                applyPresets(presets, ext, c, a, storybookOptions),
            },
          },
          presets
        ),
      };

      return accumulationPromise.then((newConfig) =>
        extensionFn.call(context.preset, newConfig, context.combinedOptions)
      );
    }

    return accumulationPromise.then((newConfig) => {
      if (Array.isArray(newConfig) && Array.isArray(change)) {
        return [...newConfig, ...change];
      }
      if (isObject(newConfig) && isObject(change)) {
        return { ...newConfig, ...change };
      }
      return change;
    });
  }, presetResult);
}

export async function getPresets(
  presets: PresetConfig[],
  storybookOptions: InterPresetOptions,
  onLoad?: (presets: LoadedPreset[], options: InterPresetOptions) => void,
  resolveNative?: NativePresetResolver
): Promise<Presets> {
  const loadedPresets: LoadedPreset[] = await loadPresets(
    presets,
    0,
    storybookOptions,
    resolveNative
  );

  onLoad?.(loadedPresets, storybookOptions);
  return {
    apply: async (extension: string, config?: any, args = {}) =>
      applyPresets(loadedPresets, extension, config, args, storybookOptions),
  };
}

export async function loadAllPresets(
  options: CLIOptions &
    LoadOptions &
    BuilderOptions & {
      corePresets: PresetConfig[];
      overridePresets: PresetConfig[];
      /** Whether preset failures should be critical or not */
      isCritical?: boolean;
      build?: StorybookConfigRaw['build'];
      channel: ChannelLike;
      main?: StorybookConfig;
    },
  onLoad?: (presets: LoadedPreset[], options: InterPresetOptions) => void,
  resolveNative?: NativePresetResolver
) {
  const { corePresets = [], overridePresets = [], main, ...restOptions } = options;
  if (!main) {
    validateConfigurationFiles(options.configDir);
  }

  const mainPreset = main
    ? { type: 'virtual', name: 'main', ...main }
    : (getInterpretedFile(resolve(options.configDir, 'main')) as string);
  const presetsConfig: PresetConfig[] = [...corePresets, mainPreset, ...overridePresets];

  // Remove `@storybook/preset-typescript` and add a warning if in use.
  const filteredPresetConfig = filterPresetsConfig(presetsConfig);
  if (filteredPresetConfig.length < presetsConfig.length) {
    logger.warn(
      'Storybook now supports TypeScript natively. You can safely remove `@storybook/preset-typescript`.'
    );
  }

  return getPresets(filteredPresetConfig, restOptions, onLoad, resolveNative);
}
