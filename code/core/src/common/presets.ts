import { logger } from 'storybook/internal/node-logger';
import { CriticalPresetLoadError } from 'storybook/internal/server-errors';
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
} from 'storybook/internal/types';

import { readFileSync } from 'node:fs';

import { isAbsolute, join, parse, resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import type { ChannelLike } from '../channels/index.ts';
import { importModule, safeResolveModule } from '../shared/utils/module.ts';
import { getAddonNames } from './utils/get-addon-names.ts';
import { getInterpretedFile } from './utils/interpret-files.ts';
import { findStorybookVitestConfig } from './utils/storybook-vitest-config.ts';
import { stripAbsNodeModulesPath } from './utils/strip-abs-node-modules-path.ts';
import { validateConfigurationFiles } from './utils/validate-configuration-files.ts';

export type InterPresetOptions = Omit<
  CLIOptions &
    LoadOptions &
    BuilderOptions & { isCritical?: boolean; build?: StorybookConfigRaw['build'] },
  'frameworkPresets'
>;

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
 * - `'@storybook/addon-docs/preset' => { type: 'presets', item }`
 * - `'@storybook/addon-docs' => { type: 'presets', item: '@storybook/addon-docs/preset' }`
 * - `{ name: '@storybook/addon-docs(/preset)?', options: { } } => { type: 'presets', item: { name:
 *   '@storybook/addon-docs/preset', options } }`
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
  storybookOptions: InterPresetOptions
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
      const subPresets = contents;
      return await loadPresets(subPresets, level + 1, storybookOptions);
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
        ...(await loadPresets([...subPresets], level + 1, storybookOptions)),
        ...(await loadPresets(
          [...subAddons.map(map(storybookOptions))].filter(Boolean) as PresetConfig[],
          level + 1,
          storybookOptions
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
  storybookOptions: InterPresetOptions
): Promise<LoadedPreset[]> {
  if (!presets || !Array.isArray(presets) || !presets.length) {
    return [];
  }

  // Sequential on purpose: a CJS preset that require()s an ESM module still being import()ed in parallel crashes with ERR_INTERNAL_ASSERTION.
  const loaded: LoadedPreset[] = [];
  for (const preset of presets) {
    loaded.push(...(await loadPreset(preset, level, storybookOptions)));
  }

  return loaded;
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
        combinedOptions: {
          ...storybookOptions,
          ...args,
          ...options,
          presetsList: presets,
          presets: {
            apply: async (ext: string, c: any, a = {}) =>
              applyPresets(presets, ext, c, a, storybookOptions),
          },
        },
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
  storybookOptions: InterPresetOptions
): Promise<Presets> {
  return presetsFromLoaded(await loadPresets(presets, 0, storybookOptions), storybookOptions);
}

function presetsFromLoaded(
  loadedPresets: LoadedPreset[],
  storybookOptions: InterPresetOptions
): Presets {
  return {
    apply: async (extension: string, config?: any, args = {}) =>
      applyPresets(loadedPresets, extension, config, args, storybookOptions),
  };
}

const ADDON_VITEST = '@storybook/addon-vitest';

/**
 * The Vitest config that registers the `storybookTest` plugin for this Storybook strictly (inside
 * the config dir, or with a `configDir` option that names it), when `@storybook/addon-vitest`
 * resolves from the config dir. A loose match (a plugin that may run another Storybook) does not
 * count.
 */
function findAddonVitestPluginConfig(configDir: string) {
  const { configFile, loose } = findStorybookVitestConfig({ configDir });
  if (!configFile || loose) {
    return undefined;
  }
  const resolved = resolveAddonName(configDir, ADDON_VITEST, undefined);
  return resolved ? { configFile, resolved } : undefined;
}

/**
 * Whether the Storybook in `configDir` can run story tests through `@storybook/addon-vitest`
 * without loading its presets: `main` lists the addon, or a Vite or Vitest config registers its
 * plugin for this Storybook and the addon is installed (then {@link loadAllPresets} enables it).
 *
 * For callers that decide from the config alone, such as the test step of the `AGENTS.md`
 * section. With loaded presets, `presets.apply('isAddonVitestEnabled', false)` is exact; this can
 * miss an addon that `main` lists only through a preset of its own.
 */
export function isAddonVitestConfigured({
  configDir,
  mainConfig,
}: {
  configDir: string;
  mainConfig: Pick<StorybookConfigRaw, 'addons'>;
}): boolean {
  try {
    return (
      getAddonNames(mainConfig as StorybookConfig).includes(ADDON_VITEST) ||
      findAddonVitestPluginConfig(configDir) !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * Addons a project uses without listing them: `@storybook/addon-vitest` when a Vite or Vitest config
 * registers its `storybookTest` plugin for this Storybook (inside the config dir, or with a
 * `configDir` option that names it). Such a project runs its story tests through Vitest already;
 * enabling the addon lets Storybook run them too (the test widget, `storybook tools test run`, the
 * MCP `test-run` tool), from the same config. `build.test.disabledAddons` still turns it off.
 *
 * {@link loadAllPresets} adds these only when no loaded preset enabled the addon already, however
 * `main` or a preset of it lists it.
 */
export async function getImplicitAddons(
  configDir: string,
  build?: StorybookConfigRaw['build']
): Promise<PresetConfig[]> {
  try {
    if (build?.test?.disabledAddons?.some((name) => name.includes(ADDON_VITEST))) {
      return [];
    }
    const found = findAddonVitestPluginConfig(configDir);
    if (!found) {
      return [];
    }
    logger.debug(
      `Enabling ${ADDON_VITEST}: ${found.configFile} uses its Vitest plugin for this Storybook, though the main config does not list the addon.`
    );
    return [found.resolved as PresetConfig];
  } catch {
    return [];
  }
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
    }
) {
  const { corePresets = [], overridePresets = [], ...restOptions } = options;
  validateConfigurationFiles(options.configDir);

  const mainUrl = getInterpretedFile(resolve(options.configDir, 'main')) as string;
  const presetsConfig: PresetConfig[] = [...corePresets, mainUrl];

  // Remove `@storybook/preset-typescript` and add a warning if in use.
  const filteredPresetConfig = filterPresetsConfig(presetsConfig);
  const filteredOverridePresets = filterPresetsConfig(overridePresets);
  if (
    filteredPresetConfig.length < presetsConfig.length ||
    filteredOverridePresets.length < overridePresets.length
  ) {
    logger.warn(
      'Storybook now supports TypeScript natively. You can safely remove `@storybook/preset-typescript`.'
    );
  }

  const loaded = await loadPresets(filteredPresetConfig, 0, restOptions);
  // Only the full pass: the critical first pass only determines the builder, and an addon the
  // project did not list must never make it fail. Decided on the loaded presets, so an addon that
  // `main` lists in a form `getAddonNames` cannot read (a relative path, a preset of its own) is
  // never loaded twice.
  if (!options.isCritical && !loaded.some(({ preset }) => preset?.isAddonVitestEnabled === true)) {
    loaded.push(
      ...(await loadPresets(
        await getImplicitAddons(options.configDir, options.build),
        0,
        restOptions
      ))
    );
  }
  loaded.push(...(await loadPresets(filteredOverridePresets, 0, restOptions)));

  return presetsFromLoaded(loaded, restOptions);
}
