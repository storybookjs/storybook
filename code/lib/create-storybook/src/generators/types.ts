import type { NpmOptions, ProjectType, SupportedLanguage } from 'storybook/internal/cli';
import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import type {
  Feature,
  StorybookConfig,
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';
import type { FrameworkPreviewParts } from './configure';

export type GeneratorOptions = {
  language: SupportedLanguage;
  builder: SupportedBuilder;
  framework: SupportedFramework;
  renderer: SupportedRenderer;
  linkable: boolean;
  // TODO: Remove in SB11
  pnp: boolean;
  frameworkPreviewParts?: FrameworkPreviewParts;
  // skip prompting the user
  yes: boolean;
  features: Set<Feature>;
  dependencyCollector: DependencyCollector;
};

export interface FrameworkOptions {
  extraPackages?: string[] | ((details: { builder: SupportedBuilder }) => Promise<string[]>);
  extraAddons?: string[];
  staticDir?: string;
  addScripts?: boolean;
  addComponents?: boolean;
  webpackCompiler?: ({ builder }: { builder: SupportedBuilder }) => 'babel' | 'swc' | undefined;
  extraMain?: any;
  extensions?: string[];
  storybookConfigFolder?: string;
  componentsDestinationPath?: string;
  installFrameworkPackages?: boolean;
  skipGenerator?: boolean;
  storybookCommand?: string | null;
  shouldRunDev?: boolean;
  frameworkPreviewParts?: FrameworkPreviewParts;
}

export type Generator<T = Record<string, any>> = (
  packageManagerInstance: JsPackageManager,
  npmOptions: NpmOptions,
  generatorOptions: GeneratorOptions,
  commandOptions?: CommandOptions
) => Promise<
  {
    rendererPackage: string;
    builderPackage: string;
    frameworkPackage: string;
    configDir: string;
    mainConfig?: StorybookConfig;
    mainConfigCSFFile?: ConfigFile;
    previewConfigPath?: string;
  } & T
>;

// New generator interface for configuration-based generators

export interface GeneratorMetadata {
  projectType: ProjectType;
  renderer: SupportedRenderer;
  /**
   * If the framework is a function, it will be called with the detected builder to determine the
   * framework. This is useful for project types that support multiple frameworks based on the
   * builder (e.g., Next.js with Vite vs Webpack).
   */
  framework?: SupportedFramework | null | ((builder: SupportedBuilder) => SupportedFramework);
  /**
   * If the builder is a function, it will be called to determine the builder. This is useful for
   * generators that need to determine the builder based on the project type in cases where the
   * builder cannot be detected (Webpack and Vite are both non-existent dependencies).
   */
  builderOverride?: SupportedBuilder | (() => SupportedBuilder | Promise<SupportedBuilder>);
}

export interface GeneratorContext {
  framework: SupportedFramework | null | undefined;
  renderer: SupportedRenderer;
  builder: SupportedBuilder;
  language: SupportedLanguage;
  features: Set<Feature>;
  dependencyCollector: DependencyCollector;
  linkable?: boolean;
  yes?: boolean;
}

export interface GeneratorModule {
  /** Metadata about the generator This is used to register the generator with the generator registry */
  metadata: GeneratorMetadata;
  /**
   * The function that configures the generator This is used to configure the generator It returns a
   * promise that resolves to the framework options
   */
  configure: (
    packageManager: JsPackageManager,
    context: GeneratorContext
    // Return undefined if the base generator shouldn't be executed
  ) => Promise<FrameworkOptions>;
  /**
   * The function that runs after the generator is configured. This is used to run any
   * post-configuration tasks
   */
  postConfigure?: ({
    packageManager,
  }: {
    packageManager: JsPackageManager;
  }) => Promise<void> | void;
}

export type CommandOptions = {
  packageManager: PackageManagerName;
  usePnp?: boolean;
  features: Set<Feature>;
  type?: ProjectType;
  force?: any;
  html?: boolean;
  skipInstall?: boolean;
  language?: SupportedLanguage;
  parser?: string;
  // Automatically answer yes to prompts
  yes?: boolean;
  builder?: SupportedBuilder;
  linkable?: boolean;
  disableTelemetry?: boolean;
  enableCrashReports?: boolean;
  debug?: boolean;
  dev?: boolean;
  logfile?: string | boolean;
};
