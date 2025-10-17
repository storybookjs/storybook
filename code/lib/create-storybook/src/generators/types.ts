import type { Builder, NpmOptions, ProjectType, SupportedLanguage } from 'storybook/internal/cli';
import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import type { StorybookConfig } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';
import type { FrameworkPreviewParts } from './configure';

export type GeneratorOptions = {
  language: SupportedLanguage;
  builder: Builder;
  linkable: boolean;
  pnp: boolean;
  projectType: ProjectType;
  frameworkPreviewParts?: FrameworkPreviewParts;
  // skip prompting the user
  yes: boolean;
  features: Array<GeneratorFeature>;
  dependencyCollector: DependencyCollector;
};

export interface FrameworkOptions {
  extraPackages?: string[] | ((details: { builder: Builder }) => Promise<string[]>);
  extraAddons?: string[];
  staticDir?: string;
  addScripts?: boolean;
  addComponents?: boolean;
  webpackCompiler?: ({ builder }: { builder: Builder }) => 'babel' | 'swc' | undefined;
  extraMain?: any;
  extensions?: string[];
  framework?: Record<string, any>;
  storybookConfigFolder?: string;
  componentsDestinationPath?: string;
  installFrameworkPackages?: boolean;
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

export type GeneratorFeature = 'docs' | 'test' | 'onboarding';

export type CommandOptions = {
  packageManager: PackageManagerName;
  usePnp?: boolean;
  features: GeneratorFeature[];
  type?: ProjectType;
  force?: any;
  html?: boolean;
  skipInstall?: boolean;
  language?: SupportedLanguage;
  parser?: string;
  // Automatically answer yes to prompts
  yes?: boolean;
  builder?: Builder;
  linkable?: boolean;
  disableTelemetry?: boolean;
  enableCrashReports?: boolean;
  debug?: boolean;
  dev?: boolean;
};
