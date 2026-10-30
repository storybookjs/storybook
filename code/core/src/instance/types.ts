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
import type { BuilderAddon, AddonMeta, StorybookConfig, StorybookAddon } from './addons.ts';

/** Host pieces `createStorybook` sets up around `main.ts`. */
export interface CreateStorybookOptions {
  /** Defaults to core's docgen, story-docs and change-detection addons; their hooks run before the other addons'. */
  builtInAddons?: readonly StorybookAddon[];
  setupAddon?: (addon: StorybookAddon, storybook: Storybook) => void | Promise<void>;
  /** The host's defaults, set up before every other addon and left out of `addons`; defaults to core's. */
  common?: StorybookAddon;
  /** Load preset packages; without it, a string framework or addon with no native entry throws. */
  legacy?: LegacyAdapter;
  /** Start the dev server behind `storybook.dev()`; without it, `dev()` throws. */
  dev?: (storybook: Storybook) => Promise<StorybookDevServer>;
  /** Write the static Storybook behind `storybook.build()`; without it, `build()` throws. */
  build?: (storybook: Storybook) => Promise<StorybookBuildResult>;
}

/** A static Storybook written by `storybook.build()`. */
export interface StorybookBuildResult {
  /** The directory the static Storybook was written to. */
  outputDir: string;
}

/** A running dev server started by `storybook.dev()`. */
export interface StorybookDevServer {
  /** The port it listens on. */
  port: number;
  /** The local URL. */
  address: string;
  /** The URL reachable from the network. */
  networkAddress: string;
  /** Stop the server; `storybook.close()` calls it. */
  close(): Promise<void>;
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
  /** Addons in setup order; legacy ones carry the preset entry they stand for. */
  addons: readonly StorybookAddon[];
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
  builder?: BuilderAddon;
}

/** Core services the legacy adapter needs, kept narrow so presets cannot reach the hook runtime. */
export interface LegacyRegistrar {
  /** A preset entry that sets the addon up where it loads. */
  virtualPreset(addon: StorybookAddon): PresetConfig;
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
    /** Read the configured framework, including native addons. */
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
  /** Merged over `main` before addons load: plain-object fields merge one level deep, others replace. */
  overrides?: Partial<StorybookConfig>;
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
  /** Read the frozen configuration once `ready()` resolves. */
  readonly options: ResolvedStorybookConfig;
  /** Read the configured preview builder after setup completes. */
  readonly builder: BuilderAddon | undefined;
  /** Read the addons whose setup completed, once all addons have been set up. */
  readonly addons: readonly AddonMeta[];
  /** Check whether an addon with this package name completed setup, even when written as a path. */
  hasAddon(name: string): boolean;
  /** Add an addon before `ready()` or during setup; it dedupes and orders like a `main.ts` addon. */
  addAddon(addon: StorybookAddon): void;
  /** Load `main.ts`, set up every addon and freeze `options`; memoized, and closes the instance on failure. */
  ready(): Promise<void>;
  /** Await `ready()` and start the dev server in `mode: 'dev'`; memoized, and `close()` stops it. */
  dev(): Promise<StorybookDevServer>;
  /** Await `ready()` and write the static Storybook in `mode: 'build'`; memoized. */
  build(): Promise<StorybookBuildResult>;
  /** Register until close; override handlers run after main configuration handlers. */
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
