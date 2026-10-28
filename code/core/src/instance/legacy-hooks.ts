import type { InterPresetOptions } from '../common/presets.ts';
import type { ArgTypes } from '@storybook/core/internal/csf';
import type {
  LoadedPreset,
  Options,
  PresetPropertyFn,
  Presets,
} from '@storybook/core/internal/types';

import { logger } from '@storybook/core/internal/node-logger';

import { getInstanceContext } from '../shared/instance-context.ts';
import type { createHookRuntime } from './hooks.ts';
import type { Storybook } from './types.ts';
import {
  declareHooks,
  getHookKind,
  LEGACY_HOOK_CALL,
  type HookContext,
  type Reduce,
  type StorybookHooks,
} from './hooks.ts';

/** Legacy hooks; `StorybookHooks` extends this, as bundled declarations drop relative augmentations. */
export interface LegacyHooks {
  'legacy:resolvedReact:extend': Reduce<
    (value: Record<string, string> | undefined, ctx?: HookContext) => Record<string, string>
  >;
  'legacy:experimental_enrichCsf:extend': Reduce<
    (
      value: Parameters<PresetPropertyFn<'experimental_enrichCsf'>>[0],
      ctx?: HookContext
    ) => Awaited<ReturnType<PresetPropertyFn<'experimental_enrichCsf'>>>
  >;
  'legacy:internal_getArgTypesData:extend': Reduce<
    (
      value: unknown,
      ctx?: HookContext & { componentFilePath?: string; componentExportName?: string }
    ) => ArgTypes | null
  >;
}

/** Shared by renderers and addons, so calls resolve to the seed when no renderer extends them. */
declareHooks({
  'legacy:resolvedReact:extend': 'reduce',
  'legacy:experimental_enrichCsf:extend': 'reduce',
  'legacy:internal_getArgTypesData:extend': 'reduce',
});

export const LEGACY_HOOKS = {
  babel: 'builder:babel:extend',
  babelDefault: 'builder:babel-default:extend',
  build: 'core:build:extend',
  core: 'core:config:extend',
  csfIndexer: 'index:csf:extend',
  docs: 'core:docs:extend',
  entries: 'preview:entries:collect',
  env: 'core:env:extend',
  experimental_componentManifestGenerator: 'index:component-manifest-generator:extend',
  experimental_devServer: 'server:app:extend',
  experimental_docgenProvider: 'core:docgen-providers:collect',
  experimental_importParsers: 'core:import-parsers:collect',
  experimental_indexers: 'index:indexers:collect',
  experimental_manifests: 'index:manifests:extend',
  experimental_serverAPI: 'server:api:extend',
  experimental_serverChannel: 'server:channel:ready',
  experimental_storyDocsProvider: 'core:story-docs-provider:extend',
  favicon: 'manager:favicon:extend',
  features: 'core:features:extend',
  framework: 'core:framework:extend',
  frameworkOptions: 'core:framework-options:extend',
  isDocgenProviderEnabled: 'core:docgen-enabled:extend',
  logLevel: 'preview:log-level:extend',
  managerEntries: 'manager:entries:collect',
  managerHead: 'manager:head:extend',
  optimizeViteDeps: 'builder:vite-deps:collect',
  previewAnnotations: 'preview:annotations:collect',
  previewBody: 'preview:body:extend',
  previewHead: 'preview:head:extend',
  previewHmr: 'preview:hmr:extend',
  refs: 'manager:refs:extend',
  security: 'server:security:extend',
  services: 'core:services:register',
  staticDirs: 'core:static-dirs:collect',
  stories: 'core:stories:collect',
  storyIndexGenerator: 'index:generator:extend',
  storySorts: 'index:story-sorts:collect',
  swc: 'builder:swc:extend',
  tags: 'core:tags:extend',
  title: 'manager:title:extend',
  typescript: 'core:typescript:extend',
  viteFinal: 'builder:vite:extend',
  webpack: 'builder:webpack-config:extend',
  webpackFinal: 'builder:webpack:extend',
  webpackInstance: 'builder:webpack-instance:extend',
} as const;

const PRESETS_LIST_WARNED = Symbol('presets-list-warned');

type LegacyCall = { value: unknown };
type LegacyArgs = Record<string | symbol, unknown>;

export function legacyHookName(name: string): string {
  return Object.hasOwn(LEGACY_HOOKS, name)
    ? LEGACY_HOOKS[name as keyof typeof LEGACY_HOOKS]
    : `legacy:${name.replace(/[%:]/g, (character) => (character === ':' ? '%3A' : '%25')) || '%'}:extend`;
}

/**
 * Add the deprecated `presetsList` and its replacement `plugins` to a legacy function field's
 * options. Both are non-enumerable so spreading options down a `presets.apply` chain neither warns
 * nor reads plugins before setup.
 */
export function defineLegacyFieldOptions<T extends object>(
  options: T,
  presetsList: LoadedPreset[]
): T & Pick<Options, 'presetsList' | 'plugins'> {
  return Object.defineProperties(options, {
    presetsList: {
      configurable: true,
      get(): LoadedPreset[] {
        const state = getInstanceContext()?.state;
        if (!state?.has(PRESETS_LIST_WARNED)) {
          state?.set(PRESETS_LIST_WARNED, true);
          logger.warn(
            '`options.presetsList` is deprecated and will be removed in Storybook 12. Use `options.plugins` in main.ts function fields, or `storybook.plugins` / `storybook.hasPlugin()` in define* plugins.'
          );
        }
        return presetsList;
      },
    },
    plugins: {
      configurable: true,
      get(): Options['plugins'] {
        return (getInstanceContext()?.storybook?.plugins ?? []).map(({ name, kind }) => ({
          name,
          kind,
        }));
      },
    },
  });
}

export function bridgeLegacyPresets(
  loaded: { presetsList: LoadedPreset[]; options: InterPresetOptions },
  hooks: ReturnType<typeof createHookRuntime>,
  callHook: Storybook['callHook'],
  registrationOrder?: (preset: LoadedPreset) => number
): Presets {
  const { presetsList, options: storybookOptions } = loaded;
  const invoke = callHook as (
    name: keyof StorybookHooks,
    value: unknown,
    args: LegacyArgs
  ) => Promise<unknown>;
  const kinds = new Map<string, 'reduce' | 'collect' | 'notify'>();
  const presets = {
    async apply(extension: string, value?: unknown, args: LegacyArgs = {}): Promise<unknown> {
      const name = legacyHookName(extension);
      ensureHook(name);
      const state: LegacyCall = { value };
      const result = await invoke(name as keyof StorybookHooks, value, {
        ...args,
        [LEGACY_HOOK_CALL]: state,
      });
      return kinds.get(name) === 'notify' ? state.value : result;
    },
  } as Presets;

  function ensureHook(name: string): void {
    if (kinds.has(name)) {
      return;
    }
    const kind =
      getHookKind(name) ??
      (name.endsWith(':collect')
        ? 'collect'
        : name.endsWith(':register') || name.endsWith(':ready')
          ? 'notify'
          : 'reduce');
    kinds.set(name, kind);
    hooks.hookLegacy(name, (value: unknown) => value, kind);
  }

  for (const loaded of presetsList) {
    const { preset, options } = loaded;
    for (const [extension, change] of Object.entries(preset)) {
      if (!change) {
        continue;
      }
      const name = legacyHookName(extension);
      ensureHook(name);
      hooks.hookLegacy(
        name,
        async (value: unknown, args: LegacyArgs = {}) => {
          const { [LEGACY_HOOK_CALL]: call, ...legacyArgs } = args;
          const state = call as LegacyCall | undefined;
          const previous = kinds.get(name) === 'notify' && state ? state.value : value;
          const next =
            typeof change === 'function'
              ? await change.call(
                  preset,
                  previous,
                  defineLegacyFieldOptions(
                    { ...storybookOptions, ...legacyArgs, ...options, presets },
                    presetsList
                  )
                )
              : mergeLegacyValue(previous, change);
          if (state) {
            state.value = next;
          }
          return next;
        },
        kinds.get(name)!,
        registrationOrder?.(loaded)
      );
    }
  }
  return presets;
}

function mergeLegacyValue(value: unknown, change: unknown): unknown {
  if (Array.isArray(value) && Array.isArray(change)) {
    return [...value, ...change];
  }
  if (isObject(value) && isObject(change)) {
    return { ...value, ...change };
  }
  return change;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
