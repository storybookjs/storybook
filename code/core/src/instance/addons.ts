import type { UnionToIntersection } from 'type-fest';

import type { BuiltInTypes } from '../csf/core-annotations.ts';

import type { Server as HttpServer } from 'node:http';

import type {
  BuilderResult,
  Stats,
  Preset,
  ServerApp,
  StorybookConfig as LegacyConfig,
  StorybookFeatures,
} from '@storybook/core/internal/types';

import type { ChangeDetectionAdapter } from '../shared/open-service/services/module-graph/engine/adapters/types.ts';
import type { PreviewHmr } from '../preview-page/constants.ts';
import type { PreviewSources } from '../preview-page/preview-sources.ts';
import type { Storybook } from './types.ts';

/** Brand an addon factory with its kind so `<pkg>/node` default exports load natively. */
export const ADDON_FACTORY = Symbol.for('storybook.addon-factory');

/** Hold the options a branded factory was called with, so duplicate entries can be compared. */
export const ADDON_OPTIONS = Symbol.for('storybook.addon-options');

/** Describe the metadata supplied by an addon factory. */
export interface AddonMetaInput {
  name: string;
  /** Register manager panels and tools in ascending order. */
  order?: number;
}

/** Describe an instance addon before any setup function runs. */
export type AddonMeta = AddonMetaInput & {
  kind: 'framework' | 'builder' | 'renderer' | 'addon';
};

/** Register one addon's contributions during setup. */
export interface StorybookAddon<TTypes = unknown> {
  /** Carry preview-facing types for inference; never assign at runtime. */
  readonly types?: TTypes;
  meta: AddonMeta;
  /** Locate the manager entry as an absolute path. */
  manager?: string;
  /** Feature defaults applied before setup, at this addon's position and before `main.ts`. */
  features?: Partial<StorybookFeatures>;
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
export interface BuilderAddon extends StorybookAddon {
  /** Identify the builder package. */
  meta: AddonMeta & { kind: 'builder' };
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
export interface RendererAddon<TTypes = unknown> extends StorybookAddon<TTypes> {
  /** Identify the renderer package. */
  meta: AddonMeta & { kind: 'renderer' };
  /** Contribute preview entries in order. */
  previewAnnotations?: string[];
}

/** Compose the builder, renderer, and default addons for a framework. */
export interface FrameworkAddon<
  TRenderer extends StorybookAddon<unknown> = RendererAddon | StorybookAddon,
  TAddons extends readonly StorybookAddon<unknown>[] = readonly StorybookAddon<unknown>[],
  TName extends string = string,
> extends StorybookAddon {
  /** Identify the framework package; the literal selects its `StorybookFrameworks` entry. */
  meta: AddonMeta & { kind: 'framework'; name: TName };
  /** Own the preview compiler. */
  builder: BuilderAddon;
  /** Supply the renderer's annotations and story types. */
  renderer: TRenderer;
  /** Set up these defaults right before the framework, after its builder and renderer. */
  addons?: TAddons;
}

/** Adapt a package-name preset to the instance loader. */
export interface LegacyPreset extends StorybookAddon {
  legacy: Preset;
}

/**
 * Map a framework package name to the main configuration it accepts. Frameworks augment it.
 *
 * @example
 *
 * ```ts
 * declare module '@storybook/core' {
 *   interface StorybookFrameworks {
 *     '@storybook/react-vite': { options: ReactViteOptions; config: StorybookConfig };
 *   }
 * }
 * ```
 */
export interface StorybookFrameworks {}

/** Accept existing package entries alongside instance addons. */
export type StorybookConfig = Omit<LegacyConfig, 'framework' | 'addons'> & {
  framework?: LegacyConfig['framework'] | FrameworkAddon | LegacyPreset;
  addons?: (Preset | StorybookAddon<unknown>)[];
};

/** Read the main configuration's framework and native addon declarations. */
export type MainConfig = Pick<StorybookConfig, 'framework' | 'addons'>;

/** Combine a framework's renderer and default addon types. */
export type FrameworkTypes<F extends FrameworkAddon> = NonNullable<F['renderer']['types']> &
  AddonTypes<NonNullable<F['addons']>>;

/** Combine the configured renderer, built-in features, and native addon types. */
export type MainTypes<TMain extends MainConfig> = FrameworkTypes<
  Extract<NonNullable<TMain['framework']>, FrameworkAddon>
> &
  BuiltInTypes &
  AddonTypes<NonNullable<TMain['addons']>>;

type FrameworkName<TFramework> = TFramework extends string
  ? TFramework
  : TFramework extends { meta: { name: infer TName } }
    ? TName
    : TFramework extends { name: infer TName }
      ? TName
      : never;

/** Unregistered frameworks accept any key so configs without loaded framework types compile. */
type FrameworkMainConfig<TFramework> = [FrameworkName<TFramework>] extends [never]
  ? StorybookConfig
  : FrameworkName<TFramework> extends keyof StorybookFrameworks
    ? RegisteredMainConfig<
        FrameworkName<TFramework>,
        StorybookFrameworks[FrameworkName<TFramework>]
      >
    : StorybookConfig & { [key: string]: unknown };

type RegisteredMainConfig<TName extends string, TEntry> = TEntry extends {
  options: infer TOptions;
  config: infer TConfig;
}
  ? Omit<StorybookConfig, 'framework' | keyof TConfig> &
      Omit<TConfig, 'framework' | 'addons'> &
      Pick<StorybookConfig, 'addons'> & {
        framework:
          | TName
          | { name: TName; options?: TOptions }
          | FrameworkAddon<StorybookAddon<unknown>, readonly StorybookAddon<unknown>[], TName>;
      }
  : never;

type AddonTypes<TAddons extends readonly unknown[]> = [AddonTypesOf<TAddons[number]>] extends [
  never,
]
  ? {}
  : UnionToIntersection<AddonTypesOf<TAddons[number]>>;

type AddonTypesOf<TAddon> =
  TAddon extends StorybookAddon<infer TTypes>
    ? keyof TTypes extends never
      ? never
      : TTypes
    : never;

/**
 * Define the main configuration, typed by the framework's `StorybookFrameworks` entry. Unknown keys
 * error unless the framework is not registered.
 */
export function defineMain<
  const TFramework extends StorybookConfig['framework'] = undefined,
  const T extends FrameworkMainConfig<TFramework> = FrameworkMainConfig<TFramework>,
>(
  config: T & { framework?: TFramework } & NoInfer<
      Record<Exclude<keyof T, keyof FrameworkMainConfig<TFramework>>, never>
    >
): T {
  return config;
}

/** Create an addon factory with typed configuration options. */
export function defineAddon<TOptions = void, TTypes = {}>(
  factory: (options: TOptions) => Omit<StorybookAddon<TTypes>, 'meta'> & {
    meta: AddonMetaInput & { kind?: never };
  }
): (options: TOptions) => StorybookAddon<TTypes> & { meta: AddonMeta & { kind: 'addon' } } {
  return brand('addon', (options: TOptions) => {
    const addon = factory(options);
    return { ...addon, meta: { ...addon.meta, kind: 'addon' as const } };
  });
}

/** Create a builder factory with typed configuration options. */
export function defineBuilder<TOptions = void>(
  factory: (options: TOptions) => Omit<BuilderAddon, 'meta'> & {
    meta: AddonMetaInput & { kind?: never };
  }
): (options: TOptions) => BuilderAddon {
  return brand('builder', (options: TOptions): BuilderAddon => {
    const addon = factory(options);
    return { ...addon, meta: { ...addon.meta, kind: 'builder' } };
  });
}

/** Create a framework factory named after its package, with typed configuration options. */
export function defineFramework<
  const TName extends string,
  TOptions = void,
  TRenderer extends StorybookAddon<unknown> = RendererAddon | StorybookAddon,
  TAddons extends readonly StorybookAddon<unknown>[] = readonly StorybookAddon<unknown>[],
>(
  factory: (options: TOptions) => Omit<FrameworkAddon<TRenderer, TAddons, TName>, 'meta'> & {
    meta: AddonMetaInput & { name: TName; kind?: never };
  }
): (options: TOptions) => FrameworkAddon<TRenderer, TAddons, TName> {
  return brand('framework', (options: TOptions): FrameworkAddon<TRenderer, TAddons, TName> => {
    const addon = factory(options);
    return { ...addon, meta: { ...addon.meta, kind: 'framework' } };
  });
}

/** Create a renderer factory with typed configuration and story types. */
export function defineRenderer<TOptions = void, TTypes = unknown>(
  factory: (options: TOptions) => Omit<RendererAddon<TTypes>, 'meta'> & {
    meta: AddonMetaInput & { kind?: never };
  }
): (options: TOptions) => RendererAddon<TTypes> {
  return brand('renderer', (options: TOptions): RendererAddon<TTypes> => {
    const addon = factory(options);
    return { ...addon, meta: { ...addon.meta, kind: 'renderer' } };
  });
}

/** Keep a package-name preset on the existing preset loading path. */
export function legacyPreset(preset: Preset, kind: AddonMeta['kind'] = 'addon'): LegacyPreset {
  return {
    meta: { name: typeof preset === 'string' ? preset : preset.name, kind },
    legacy: preset,
    setup(): void {},
  };
}

function brand<T extends (options: never) => StorybookAddon<unknown>>(
  kind: AddonMeta['kind'],
  factory: T
): T {
  const branded = ((options: never) =>
    Object.defineProperty(factory(options), ADDON_OPTIONS, { value: options })) as T;
  return Object.assign(branded, { [ADDON_FACTORY]: kind });
}
