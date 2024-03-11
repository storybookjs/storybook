/* eslint-disable @typescript-eslint/naming-convention */
import type { FileSystemCache } from 'file-system-cache';
import type { Options as SWCOptions } from '@swc/core';
import type { Options as TelejsonOptions } from 'telejson';
import type { TransformOptions as BabelOptions } from '@babel/core';
import type { Router } from 'express';
import type { Server } from 'http';
import type { PackageJson as PackageJsonFromTypeFest } from 'type-fest';

import type { StoriesEntry, Indexer, StoryIndexer } from './indexer';

/**
 * ⚠️ This file contains internal WIP types they MUST NOT be exported outside this package for now!
 */

export type BuilderName = 'webpack5' | '@storybook/builder-webpack5' | string;
export type RendererName = string;

interface ServerChannel {
  emit(type: string, args?: any): void;
}

export interface CoreConfig {
  builder?:
    | BuilderName
    | {
        name: BuilderName;
        options?: Record<string, any>;
      };
  renderer?: RendererName;
  disableWebpackDefaults?: boolean;
  channelOptions?: Partial<TelejsonOptions>;
  /**
   * Disables the generation of project.json, a file containing Storybook metadata
   */
  disableProjectJson?: boolean;
  /**
   * Disables Storybook telemetry
   * @see https://storybook.js.org/telemetry
   */
  disableTelemetry?: boolean;

  /**
   * Disables notifications for Storybook updates.
   */
  disableWhatsNewNotifications?: boolean;
  /**
   * Enable crash reports to be sent to Storybook telemetry
   * @see https://storybook.js.org/telemetry
   */
  enableCrashReports?: boolean;
  /**
   * enable CORS headings to run document in a "secure context"
   * see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
   * This enables these headers in development-mode:
   *   Cross-Origin-Opener-Policy: same-origin
   *   Cross-Origin-Embedder-Policy: require-corp
   */
  crossOriginIsolated?: boolean;
}

interface DirectoryMapping {
  from: string;
  to: string;
}

interface AllSupportedPresets extends StorybookConfig {
  entries: unknown;
  managerEntries: string[];
  docs: DocsOptions;
  favicon: string;
  title: string;
}

type UnwrapFunctionReturnType<T> = T extends (
  config: infer R,
  options: Options
) => infer R | Promise<infer R>
  ? R
  : T;

type UnwrapPromise<T> = T extends Promise<infer P> ? P : T;

type UnwrapPresetType<K extends keyof AllSupportedPresets> =
  AllSupportedPresets[K] extends undefined
    ? undefined
    : UnwrapPromise<UnwrapFunctionReturnType<NonNullable<AllSupportedPresets[K]>>>;

export interface Presets {
  apply<TKey extends keyof AllSupportedPresets>(
    extension: TKey,
    config?: Partial<UnwrapPresetType<TKey>> | null,
    args?: any
  ): Promise<UnwrapPresetType<TKey>>;

  apply<TReturn = never>(
    extension: string,
    config?: Partial<TReturn> | null,
    args?: any
  ): Promise<TReturn>;
}

export interface LoadedPreset {
  name: string;
  preset: any;
  options: any;
}

export type PresetConfig =
  | string
  | {
      name: string;
      options?: unknown;
    };

export interface Ref {
  id: string;
  url: string;
  title: string;
  version: string;
  type?: string;
  disable?: boolean;
  expanded?: boolean;
}

export interface VersionCheck {
  success: boolean;
  cached: boolean;
  data?: any;
  error?: any;
  time: number;
}

export interface Stats {
  toJson: () => any;
}

export interface BuilderResult {
  totalTime?: ReturnType<typeof process.hrtime>;
  stats?: Stats;
}

export type PackageJson = PackageJsonFromTypeFest & Record<string, any>;

// TODO: This could be exported to the outside world and used in `options.ts` file of each `@storybook/APP`
// like it's described in docs/api/new-frameworks.md
export interface LoadOptions {
  packageJson: PackageJson;
  outputDir?: string;
  configDir?: string;
  ignorePreview?: boolean;
  extendServer?: (server: Server) => void;
}

export interface CLIOptions {
  port?: number;
  ignorePreview?: boolean;
  previewUrl?: string;
  forceBuildPreview?: boolean;
  disableTelemetry?: boolean;
  enableCrashReports?: boolean;
  host?: string;
  initialPath?: string;
  /**
   * @deprecated Use 'staticDirs' Storybook Configuration option instead
   */
  staticDir?: string[];
  configDir?: string;
  https?: boolean;
  sslCa?: string[];
  sslCert?: string;
  sslKey?: string;
  smokeTest?: boolean;
  managerCache?: boolean;
  open?: boolean;
  ci?: boolean;
  loglevel?: string;
  quiet?: boolean;
  versionUpdates?: boolean;
  docs?: boolean;
  test?: boolean;
  debugWebpack?: boolean;
  webpackStatsJson?: string | boolean;
  outputDir?: string;
}

export interface BuilderOptions {
  configType?: 'DEVELOPMENT' | 'PRODUCTION';
  ignorePreview?: boolean;
  cache?: FileSystemCache;
  configDir: string;
  docsMode?: boolean;
  features?: StorybookConfig['features'];
  versionCheck?: VersionCheck;
  disableWebpackDefaults?: boolean;
  serverChannelUrl?: string;
}

export interface StorybookConfigOptions {
  presets: Presets;
  presetsList?: LoadedPreset[];
}

export type Options = LoadOptions &
  StorybookConfigOptions &
  CLIOptions &
  BuilderOptions & { build?: TestBuildConfig };

export interface Builder<Config, BuilderStats extends Stats = Stats> {
  getConfig: (options: Options) => Promise<Config>;
  start: (args: {
    options: Options;
    startTime: ReturnType<typeof process.hrtime>;
    router: Router;
    server: Server;
    channel: ServerChannel;
  }) => Promise<void | {
    stats?: BuilderStats;
    totalTime: ReturnType<typeof process.hrtime>;
    bail: (e?: Error) => Promise<void>;
  }>;
  build: (arg: {
    options: Options;
    startTime: ReturnType<typeof process.hrtime>;
  }) => Promise<void | BuilderStats>;
  bail: (e?: Error) => Promise<void>;
  corePresets?: string[];
  overridePresets?: string[];
}

/**
 * Options for TypeScript usage within Storybook.
 */
export interface TypescriptOptions {
  /**
   * Enables type checking within Storybook.
   *
   * @default `false`
   */
  check: boolean;
  /**
   * Disable parsing typescript files through babel.
   *
   * @default `false`
   * @deprecated use `skipCompiler` instead
   */
  skipBabel: boolean;

  /**
   * Disable parsing typescript files through compiler.
   *
   * @default `false`
   */
  skipCompiler: boolean;
}

export type Preset =
  | string
  | {
      name: string;
      options?: any;
    };

/**
 * An additional script that gets injected into the
 * preview or the manager,
 */
export type Entry = string;

type CoreCommon_StorybookRefs = Record<string, Ref>;

export type DocsOptions = {
  /**
   * What should we call the generated docs entries?
   */
  defaultName?: string;
  /**
   * Should we generate a docs entry per CSF file?
   * Set to 'tag' (the default) to generate an entry for every CSF file with the
   * 'autodocs' tag.
   */
  autodocs?: boolean | 'tag';
  /**
   * Only show doc entries in the side bar (usually set with the `--docs` CLI flag)
   */
  docsMode?: boolean;
};

export interface TestBuildFlags {
  /**
   * The package @storybook/blocks will be excluded from the bundle, even when imported in e.g. the preview.
   */
  disableBlocks?: boolean;
  /**
   * Disable specific addons
   */
  disabledAddons?: string[];
  /**
   * Filter out .mdx stories entries
   */
  disableMDXEntries?: boolean;
  /**
   * Override autodocs to be disabled
   */
  disableAutoDocs?: boolean;
  /**
   * Override docgen to be disabled.
   */
  disableDocgen?: boolean;
  /**
   * Override sourcemaps generation to be disabled.
   */
  disableSourcemaps?: boolean;
  /**
   * Override tree-shaking (dead code elimination) to be disabled.
   */
  disableTreeShaking?: boolean;
  /**
   * Minify with ESBuild when using webpack.
   */
  esbuildMinify?: boolean;
}

export interface TestBuildConfig {
  test?: TestBuildFlags;
}

/**
 * The interface for Storybook configuration in `main.ts` files.
 */
export interface StorybookConfig {
  /**
   * Sets the addons you want to use with Storybook.
   *
   * @example `['@storybook/addon-essentials']` or `[{ name: '@storybook/addon-essentials', options: { backgrounds: false } }]`
   */
  addons?: Preset[];
  core?: CoreConfig;
  /**
   * Sets a list of directories of static files to be loaded by Storybook server
   *
   * @example `['./public']` or `[{from: './public', 'to': '/assets'}]`
   */
  staticDirs?: (DirectoryMapping | string)[];
  logLevel?: string;
  features?: {
    /**
     * Build stories.json automatically on start/build
     */
    buildStoriesJson?: boolean;

    /**
     * Activate on demand story store
     */
    storyStoreV7?: boolean;

    /**
     * Do not throw errors if using `.mdx` files in SSv7
     * (for internal use in sandboxes)
     */
    storyStoreV7MdxErrors?: boolean;

    /**
     * Filter args with a "target" on the type from the render function (EXPERIMENTAL)
     */
    argTypeTargetsV7?: boolean;

    /**
     * Warn when there is a pre-6.0 hierarchy separator ('.' / '|') in the story title.
     * Will be removed in 7.0.
     */
    warnOnLegacyHierarchySeparator?: boolean;

    /**
     * Use legacy MDX1, to help smooth migration to 7.0
     */
    legacyMdx1?: boolean;

    /**
     * Apply decorators from preview.js before decorators from addons or frameworks
     */
    legacyDecoratorFileOrder?: boolean;

    /**
     * Disallow implicit actions during rendering. This will be the default in Storybook 8.
     *
     * This will make sure that your story renders the same no matter if docgen is enabled or not.
     */
    disallowImplicitActionsInRenderV8?: boolean;
  };

  build?: TestBuildConfig;

  /**
   * Tells Storybook where to find stories.
   *
   * @example `['./src/*.stories.@(j|t)sx?']`
   */
  stories: StoriesEntry[];

  /**
   * Framework, e.g. '@storybook/react-vite', required in v7
   */
  framework?: Preset;

  /**
   * Controls how Storybook handles TypeScript files.
   */
  typescript?: Partial<TypescriptOptions>;

  /**
   * References external Storybooks
   */
  refs?: PresetValue<CoreCommon_StorybookRefs>;

  /**
   * Modify or return babel config.
   */
  babel?: (config: BabelOptions, options: Options) => BabelOptions | Promise<BabelOptions>;

  /**
   * Modify or return swc config.
   */
  swc?: (config: SWCOptions, options: Options) => SWCOptions | Promise<SWCOptions>;

  /**
   * Modify or return env config.
   */
  env?: PresetValue<Record<string, string>>;

  /**
   * Modify or return babel config.
   */
  babelDefault?: (config: BabelOptions, options: Options) => BabelOptions | Promise<BabelOptions>;

  /**
   * Add additional scripts to run in the preview a la `.storybook/preview.js`
   *
   * @deprecated use `previewAnnotations` or `/preview.js` file instead
   */
  config?: PresetValue<Entry[]>;

  /**
   * Add additional scripts to run in the preview a la `.storybook/preview.js`
   */
  previewAnnotations?: PresetValue<Entry[]>;

  /**
   * Process CSF files for the story index.
   * @deprecated use {@link experimental_indexers} instead
   */
  storyIndexers?: PresetValue<StoryIndexer[]>;

  /**
   * Process CSF files for the story index.
   */
  experimental_indexers?: PresetValue<Indexer[]>;

  /**
   * Docs related features in index generation
   */
  docs?: DocsOptions;

  /**
   * Programmatically modify the preview head/body HTML.
   * The previewHead and previewBody functions accept a string,
   * which is the existing head/body, and return a modified string.
   */
  previewHead?: PresetValue<string>;

  previewBody?: PresetValue<string>;

  /**
   * Programmatically override the preview's main page template.
   * This should return a reference to a file containing an `.ejs` template
   * that will be interpolated with environment variables.
   *
   * @example '.storybook/index.ejs'
   */
  previewMainTemplate?: string;

  /**
   * Programmatically modify the preview head/body HTML.
   * The managerHead function accept a string,
   * which is the existing head content, and return a modified string.
   */
  managerHead?: PresetValue<string>;
}

export type PresetValue<T> = T | ((config: T, options: Options) => T | Promise<T>);

export type PresetProperty<K, TStorybookConfig = StorybookConfig> =
  | TStorybookConfig[K extends keyof TStorybookConfig ? K : never]
  | PresetPropertyFn<K, TStorybookConfig>;

export type PresetPropertyFn<K, TStorybookConfig = StorybookConfig, TOptions = {}> = (
  config: TStorybookConfig[K extends keyof TStorybookConfig ? K : never],
  options: Options & TOptions
) =>
  | TStorybookConfig[K extends keyof TStorybookConfig ? K : never]
  | Promise<TStorybookConfig[K extends keyof TStorybookConfig ? K : never]>;

export interface CoreCommon_ResolvedAddonPreset {
  type: 'presets';
  name: string;
}

export type PreviewAnnotation = string | { bare: string; absolute: string };

export interface CoreCommon_ResolvedAddonVirtual {
  type: 'virtual';
  name: string;
  managerEntries?: string[];
  previewAnnotations?: PreviewAnnotation[];
  presets?: (string | { name: string; options?: any })[];
}

export type CoreCommon_OptionsEntry = { name: string };
export type CoreCommon_AddonEntry = string | CoreCommon_OptionsEntry;
export type CoreCommon_AddonInfo = { name: string; inEssentials: boolean };

export interface CoreCommon_StorybookInfo {
  version: string;
  // FIXME: these are renderers for now,
  // need to update with framework OR fix
  // the calling code
  framework: string;
  frameworkPackage: string;
  renderer: string;
  rendererPackage: string;
  configDir?: string;
  mainConfig?: string;
  previewConfig?: string;
  managerConfig?: string;
}
