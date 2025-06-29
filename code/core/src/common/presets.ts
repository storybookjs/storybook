import { join, parse } from 'node:path';

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
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { interopRequireDefault } from './utils/interpret-require';
import { loadCustomPresets } from './utils/load-custom-presets';
import { safeResolve, safeResolveFrom } from './utils/safeResolve';
import { stripAbsNodeModulesPath } from './utils/strip-abs-node-modules-path';

type InterPresetOptions = Omit<
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

function resolvePathToESM(filePath: string): string {
  const { dir, name, ext } = parse(filePath);
  if (ext === '.mjs') {
    return filePath;
  }
  const mjsPath = join(dir, `${name}.mjs`);
  if (safeResolve(mjsPath)) {
    return mjsPath;
  }
  if (ext === '.cjs') {
    /*
      If the file is a CJS file, try to resolve the ESM version instead.
      We must assume that in the case that NO .mjs file exists, but a .cjs file does, the package is type="module"
      This is the case for addon-kit, which distributes both preview.cjs and preview.js for Jest compatibility
      and in that situation we want to prefer the .js version.
    */
    const jsPath = join(dir, `${name}.js`);
    if (safeResolve(jsPath)) {
      return jsPath;
    }
  }

  return filePath;
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
  const resolve = name.startsWith('/') ? safeResolve : safeResolveFrom.bind(null, configDir);
  const resolved = resolve(name);

  if (resolved) {
    const { dir: fdir, name: fname } = parse(resolved);

    if (name.match(/\/(manager|register(-panel)?)(\.(js|mjs|ts|tsx|jsx))?$/)) {
      return {
        type: 'virtual',
        name,
        // we remove the extension
        // this is a bit of a hack to try to find .mjs files
        // node can only ever resolve .js files; it does not look at the exports field in package.json
        managerEntries: [resolvePathToESM(join(fdir, fname))],
      };
    }
    if (name.match(/\/(preset)(\.(js|mjs|ts|tsx|jsx))?$/)) {
      return {
        type: 'presets',
        name: resolved,
      };
    }
  }

  const checkExists = (exportName: string) => {
    if (resolve(`${name}${exportName}`)) {
      return `${name}${exportName}`;
    }
    return undefined;
  };

  /**
   * This is used to maintain back-compat with community addons that do not re-export their
   * sub-addons but reference the sub-addon name directly. We need to turn it into an absolute path
   * so that webpack can serve it up correctly when yarn pnp or pnpm is being used. Vite will be
   * broken in such cases, because it does not process absolute paths, and it will try to import
   * from the bare import, breaking in pnp/pnpm.
   */
  const absolutizeExport = (exportName: string, preferESM: boolean) => {
    const found = resolve(`${name}${exportName}`);

    if (found) {
      return preferESM ? resolvePathToESM(found) : found;
    }
    return undefined;
  };

  const managerFile = absolutizeExport(`/manager`, true);
  const registerFile =
    absolutizeExport(`/register`, true) || absolutizeExport(`/register-panel`, true);
  const previewFile = checkExists(`/preview`);
  const previewFileAbsolute = absolutizeExport('/preview', true);
  const presetFile = absolutizeExport(`/preset`, false);

  if (!(managerFile || previewFile) && presetFile) {
    return {
      type: 'presets',
      name: presetFile,
    };
  }

  if (managerFile || registerFile || previewFile || presetFile) {
    const managerEntries = [];

    if (managerFile) {
      managerEntries.push(managerFile);
    }
    // register file is the old way of registering addons
    if (!managerFile && registerFile && !presetFile) {
      managerEntries.push(registerFile);
    }

    return {
      type: 'virtual',
      name,
      ...(managerEntries.length ? { managerEntries } : {}),
      ...(previewFile
        ? {
            previewAnnotations: [
              previewFileAbsolute
                ? {
                    // TODO: Evaluate if searching for node_modules in a yarn pnp environment is correct
                    bare: previewFile.includes('node_modules')
                      ? stripAbsNodeModulesPath(previewFile)
                      : previewFile,
                    absolute: previewFileAbsolute,
                  }
                : previewFile,
            ],
          }
        : {}),
      ...(presetFile ? { presets: [{ name: presetFile, options }] } : {}),
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
      logger.warn(`Could not resolve addon "${name}", skipping. Is it installed?`);
      return undefined;
    }

    return {
      ...(options ? { options } : {}),
      ...resolved,
    };
  };

async function getContent(input: any) {
  if (input.type === 'virtual') {
    const { type, name, ...rest } = input;
    return rest;
  }
  const name = input.name ? input.name : input;

  return interopRequireDefault(name);
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

    let contents = await getContent(input);

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

  return (
    await Promise.all(
      presets.map(async (preset) => {
        return loadPreset(preset, level, storybookOptions);
      })
    )
  ).reduce((acc, loaded) => {
    return acc.concat(loaded);
  }, []);
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
  const loadedPresets: LoadedPreset[] = await loadPresets(presets, 0, storybookOptions);

  return {
    apply: async (extension: string, config: any, args = {}) =>
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
    }
) {
  const { corePresets = [], overridePresets = [], ...restOptions } = options;

  const presetsConfig: PresetConfig[] = [
    ...corePresets,
    ...loadCustomPresets(options),
    ...overridePresets,
  ];

  // Remove `@storybook/preset-typescript` and add a warning if in use.
  const filteredPresetConfig = filterPresetsConfig(presetsConfig);
  if (filteredPresetConfig.length < presetsConfig.length) {
    logger.warn(
      'Storybook now supports TypeScript natively. You can safely remove `@storybook/preset-typescript`.'
    );
  }

  return getPresets(filteredPresetConfig, restOptions);
}
