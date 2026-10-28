import type { Channel, ChannelTransport } from '@storybook/core/internal/channels';
import type {
  BuilderOptions,
  CLIOptions,
  LoadOptions,
  Indexer,
  LoadedPreset,
  Options,
  PresetConfig,
  Presets,
  PreviewAnnotation,
  StoriesEntry,
  StoryIndex,
  StorybookConfig as LegacyConfig,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import type { StoryIndexGenerator } from '../story-index/StoryIndexGenerator.ts';
import type { getService, registerService } from '../shared/open-service/server.ts';
import type { getRegisteredToolsets, getToolset } from '../shared/open-service/toolset-registry.ts';
import type { AnyToolsetDefinition } from '../shared/open-service/toolset-definition.ts';
import type {
  HookArgs,
  HookHandler,
  HookRegistrationKind,
  HookResult,
  StorybookHooks,
} from './hooks.ts';
import type { InterPresetOptions } from '../common/presets.ts';
import type { resolveNativeFactory } from './native-entry.ts';
import type { BuilderPlugin, PluginMeta, StorybookConfig, StorybookPlugin } from './plugins.ts';

/** Host pieces `createStorybook` sets up around `main.ts`. */
export interface CreateStorybookOptions {
  /** Defaults to core's docgen and story-docs addons. */
  builtInAddons?: readonly StorybookPlugin[];
  setupPlugin?: (plugin: StorybookPlugin, storybook: Storybook) => void | Promise<void>;
  /** The host's defaults, set up before every other plugin and left out of `plugins`; defaults to core's. */
  common?: StorybookPlugin;
  /** Load preset packages; without it, a string framework or addon with no native entry throws. */
  legacy?: LegacyAdapter;
}

/** Load preset packages (`<pkg>/preset`) for frameworks, addons and builders with no native entry. */
export interface LegacyAdapter {
  load(input: LegacyAdapterInput): Promise<LegacyAdapterResult>;
}

/** What core hands the legacy adapter. */
export interface LegacyAdapterInput {
  storybook: Storybook;
  /** `main.ts` with its framework and addons rewritten to their legacy preset entries. */
  main: LegacyConfig;
  /** Plugins in setup order; legacy ones carry the preset entry they stand for. */
  plugins: readonly StorybookPlugin[];
  /** Options every preset receives, before presets load. */
  baseOptions: InterPresetOptions & { main: LegacyConfig; channel: Channel };
  registrar: LegacyRegistrar;
}

/** Presets the legacy adapter loaded, which core bridges onto the hook runtime. */
export interface LegacyAdapterResult {
  /** Loaded presets in application order, `main.ts` included. */
  presets: LoadedPreset[];
  /** Options handed to every preset function. */
  options: InterPresetOptions;
  /** A builder found through the framework's `core.builder`. */
  builder?: BuilderPlugin;
}

/** Core services the legacy adapter needs, kept narrow so presets cannot reach the hook runtime. */
export interface LegacyRegistrar {
  /** A preset entry that sets the plugin up where it loads. */
  virtualPreset(plugin: StorybookPlugin): PresetConfig;
  /** Resolve `build` flags from a discovery pass, as `main.ts` and core overrides set them. */
  resolveBuild(
    presets: LoadedPreset[],
    options: InterPresetOptions
  ): Promise<StorybookConfigRaw['build']>;
  resolveNativeFactory: typeof resolveNativeFactory;
}

/** Resolve the configuration consumed by this instance. */
export type ResolvedStorybookConfig = Readonly<
  Omit<Options, 'docs'> & {
    /** Read the configured framework, including native plugins. */
    framework: StorybookConfig['framework'];
    /** Read the main configuration loaded by this instance. */
    main: StorybookConfig;
    stories: StoriesEntry[];
    indexers: Indexer[];
    docs: NonNullable<StorybookConfigRaw['docs']>;
    previewAnnotations: PreviewAnnotation[];
    staticDirs: (DirectoryMapping | string)[];
  }
>;

/** Map a source directory onto a static URL path. */
export interface DirectoryMapping {
  from: string;
  to: string;
}

/** Read services registered by this instance. */
export interface ServiceRegistry {
  get: typeof getService;
}

/** Read toolsets registered by this instance. */
export interface ToolsetRegistry {
  get: typeof getToolset;
  values: typeof getRegisteredToolsets;
}

/** Configure Storybook without starting a server or manager. */
export interface CreateStorybookInput {
  configDir: string;
  main?: StorybookConfig;
  mode: 'dev' | 'build' | 'headless';
  /** Connect a headless instance to a running Storybook. */
  attach?: { transport: ChannelTransport };
  workingDir?: string;
  /** Pass host CLI settings through the frozen options. */
  cliOptions?: Partial<
    CLIOptions &
      BuilderOptions &
      LoadOptions & {
        build: StorybookConfigRaw['build'];
        storybookVersion: string;
        previewConfigPath: string;
      }
  >;
}

/** Own one configured Storybook and its registered capabilities. */
export interface Storybook {
  readonly mode: CreateStorybookInput['mode'];
  /** Whether this instance delegates to a running Storybook. */
  readonly attached: boolean;
  readonly configDir: string;
  readonly workingDir: string;
  /** Read the frozen configuration after setup completes. */
  readonly options: ResolvedStorybookConfig;
  /** Read the configured preview builder after setup completes. */
  readonly builder: BuilderPlugin | undefined;
  /** Read the plugins whose setup completed, once all plugins have been set up. */
  readonly plugins: readonly PluginMeta[];
  /** Check whether a plugin with this package name completed setup, even when written as a path. */
  hasPlugin(name: string): boolean;
  /** Register during setup; override handlers run after main configuration handlers. */
  hook<K extends keyof StorybookHooks>(
    name: K,
    fn: HookHandler<K>,
    kind?: HookRegistrationKind<K>,
    stage?: 'override'
  ): void;
  registerService: typeof registerService;
  registerToolset(definition: AnyToolsetDefinition): void;
  callHook<K extends keyof StorybookHooks>(name: K, ...args: HookArgs<K>): Promise<HookResult<K>>;
  getIndex(): Promise<StoryIndex>;
  getStoryIndexGenerator(): Promise<StoryIndexGenerator>;
  readonly services: ServiceRegistry;
  readonly toolsets: ToolsetRegistry;
  readonly channel: Channel;
  /** Apply existing preset hooks against this instance's context. */
  readonly presets: Presets;
  close(): Promise<void>;
}
