import type { UnionToIntersection } from 'type-fest';

import type { BuiltInTypes } from '../csf/core-annotations.ts';

import type { Server as HttpServer } from 'node:http';

import type {
  BuilderResult,
  Stats,
  Preset,
  ServerApp,
  StorybookConfig as LegacyConfig,
} from '@storybook/core/internal/types';

import type { ChangeDetectionAdapter } from '../shared/open-service/services/module-graph/engine/adapters/types.ts';
import type { PreviewHmr } from '../preview-page/constants.ts';
import type { PreviewSources } from '../preview-page/preview-sources.ts';
import type { Storybook } from './types.ts';

/** Brand a plugin factory with its kind so `<pkg>/node` default exports load natively. */
export const PLUGIN_FACTORY = Symbol.for('storybook.plugin-factory');

/** Describe the metadata supplied by a plugin factory. */
export interface PluginMetaInput {
  name: string;
  /** Register manager panels and tools in ascending order. */
  order?: number;
}

/** Describe an instance plugin before any setup function runs. */
export type PluginMeta = PluginMetaInput & {
  kind: 'framework' | 'builder' | 'renderer' | 'addon';
};

/** Register one plugin's contributions during setup. */
export interface StorybookPlugin<TTypes = unknown> {
  /** Carry preview-facing types for inference; never assign at runtime. */
  readonly types?: TTypes;
  meta: PluginMeta;
  /** Locate the manager entry, relative to the package root for built-in addons. */
  manager?: string;
  setup(storybook: Storybook): void | Promise<void>;
}

/** Hand a builder's dev server the host's server and core's preview sources. */
export interface BuilderDevHost {
  router: ServerApp;
  /** Absent when the host answers requests in-process, so no socket or HMR channel exists. */
  server?: HttpServer;
  startTime: [number, number];
  preview: PreviewSources;
}

/** Hand a builder's static build its output directory and core's preview sources. */
export interface BuilderBuildHost {
  startTime: [number, number];
  outDir: string;
  preview: PreviewSources;
}

/** Own the preview compiler and its change detection for one instance. */
export interface BuilderPlugin extends StorybookPlugin {
  /** Identify the builder package. */
  meta: PluginMeta & { kind: 'builder' };
  /** Select the HMR API of the generated preview modules; defaults to `vite`. */
  hmr?: PreviewHmr;
  /** Serve the preview using the host's router and HTTP server. */
  dev(
    storybook: Storybook,
    host: BuilderDevHost
  ): Promise<BuilderResult & { bail(): Promise<void> }>;
  /** Write the preview to `host.outDir`. */
  build(storybook: Storybook, host: BuilderBuildHost): Promise<void | Stats>;
  /** Resolve modules headlessly or subscribe to the running preview compiler. */
  changeDetectionAdapter(storybook: Storybook): ChangeDetectionAdapter;
}

/** Contribute rendering annotations and story types. */
export interface RendererPlugin<TTypes = unknown> extends StorybookPlugin<TTypes> {
  /** Identify the renderer package. */
  meta: PluginMeta & { kind: 'renderer' };
  /** Contribute preview entries in order. */
  previewAnnotations?: string[];
}

/** Compose the builder, renderer, and default addons for a framework. */
export interface FrameworkPlugin<
  TRenderer extends StorybookPlugin<unknown> = RendererPlugin | StorybookPlugin,
  TAddons extends readonly StorybookPlugin<unknown>[] = readonly StorybookPlugin<unknown>[],
> extends StorybookPlugin {
  /** Identify the framework package. */
  meta: PluginMeta & { kind: 'framework' };
  /** Own the preview compiler. */
  builder: BuilderPlugin;
  /** Supply the renderer's annotations and story types. */
  renderer: TRenderer;
  /** Set up these defaults right before the framework, after its builder and renderer. */
  addons?: TAddons;
}

/** Adapt a package-name preset to the instance loader. */
export interface LegacyPreset extends StorybookPlugin {
  legacy: Preset;
}

/** Accept existing package entries alongside instance plugins. */
export type StorybookConfig = Omit<LegacyConfig, 'framework' | 'addons'> & {
  framework?: LegacyConfig['framework'] | FrameworkPlugin | LegacyPreset;
  addons?: (Preset | StorybookPlugin<unknown>)[];
};

/** Read the main configuration's framework and native addon declarations. */
export type MainConfig = Pick<StorybookConfig, 'framework' | 'addons'>;

/** Combine a framework's renderer and default addon types. */
export type FrameworkTypes<F extends FrameworkPlugin> = NonNullable<F['renderer']['types']> &
  AddonTypes<NonNullable<F['addons']>>;

/** Combine the configured renderer, built-in features, and native addon types. */
export type MainTypes<TMain extends MainConfig> = FrameworkTypes<
  Extract<NonNullable<TMain['framework']>, FrameworkPlugin>
> &
  BuiltInTypes &
  AddonTypes<NonNullable<TMain['addons']>>;

type AddonTypes<TAddons extends readonly unknown[]> = [PluginTypes<TAddons[number]>] extends [never]
  ? {}
  : UnionToIntersection<PluginTypes<TAddons[number]>>;

type PluginTypes<TPlugin> =
  TPlugin extends StorybookPlugin<infer TTypes>
    ? keyof TTypes extends never
      ? never
      : TTypes
    : never;

/** Create an addon factory with typed configuration options. */
export function defineAddon<TOptions = void, TTypes = {}>(
  factory: (options: TOptions) => Omit<StorybookPlugin<TTypes>, 'meta'> & {
    meta: PluginMetaInput & { kind?: never };
  }
): (options: TOptions) => StorybookPlugin<TTypes> & { meta: PluginMeta & { kind: 'addon' } } {
  return brand('addon', (options: TOptions) => {
    const plugin = factory(options);
    return { ...plugin, meta: { ...plugin.meta, kind: 'addon' as const } };
  });
}

/** Create a builder factory with typed configuration options. */
export function defineBuilder<TOptions = void>(
  factory: (options: TOptions) => Omit<BuilderPlugin, 'meta'> & {
    meta: PluginMetaInput & { kind?: never };
  }
): (options: TOptions) => BuilderPlugin {
  return brand('builder', (options: TOptions): BuilderPlugin => {
    const plugin = factory(options);
    return { ...plugin, meta: { ...plugin.meta, kind: 'builder' } };
  });
}

/** Create a framework factory with typed configuration options. */
export function defineFramework<
  TOptions = void,
  TRenderer extends StorybookPlugin<unknown> = RendererPlugin | StorybookPlugin,
  TAddons extends readonly StorybookPlugin<unknown>[] = readonly StorybookPlugin<unknown>[],
>(
  factory: (options: TOptions) => Omit<FrameworkPlugin<TRenderer, TAddons>, 'meta'> & {
    meta: PluginMetaInput & { kind?: never };
  }
): (options: TOptions) => FrameworkPlugin<TRenderer, TAddons> {
  return brand('framework', (options: TOptions): FrameworkPlugin<TRenderer, TAddons> => {
    const plugin = factory(options);
    return { ...plugin, meta: { ...plugin.meta, kind: 'framework' } };
  });
}

/** Create a renderer factory with typed configuration and story types. */
export function defineRenderer<TOptions = void, TTypes = unknown>(
  factory: (options: TOptions) => Omit<RendererPlugin<TTypes>, 'meta'> & {
    meta: PluginMetaInput & { kind?: never };
  }
): (options: TOptions) => RendererPlugin<TTypes> {
  return brand('renderer', (options: TOptions): RendererPlugin<TTypes> => {
    const plugin = factory(options);
    return { ...plugin, meta: { ...plugin.meta, kind: 'renderer' } };
  });
}

/** Keep a package-name preset on the existing preset loading path. */
export function legacyPreset(preset: Preset, kind: PluginMeta['kind'] = 'addon'): LegacyPreset {
  return {
    meta: { name: typeof preset === 'string' ? preset : preset.name, kind },
    legacy: preset,
    setup(): void {},
  };
}

function brand<T extends (options: never) => StorybookPlugin<unknown>>(
  kind: PluginMeta['kind'],
  factory: T
): T {
  return Object.assign(factory, { [PLUGIN_FACTORY]: kind });
}
