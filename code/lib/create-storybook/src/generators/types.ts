import type { NpmOptions } from 'storybook/internal/cli';
import type { Builder, ProjectType, SupportedLanguage } from 'storybook/internal/cli';
import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';

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
};

export interface FrameworkOptions {
  extraPackages?:
    | string[]
    | ((details: { framework: string; builder: string }) => Promise<string[]>);
  extraAddons?: string[] | ((details: { framework: string; builder: string }) => Promise<string[]>);
  staticDir?: string;
  addScripts?: boolean;
  addMainFile?: boolean;
  addComponents?: boolean;
  webpackCompiler?: ({ builder }: { builder: Builder }) => 'babel' | 'swc' | undefined;
  extraMain?: any;
  extensions?: string[];
  framework?: Record<string, any>;
  storybookConfigFolder?: string;
  componentsDestinationPath?: string;
}

export type Generator<T = void> = (
  packageManagerInstance: JsPackageManager,
  npmOptions: NpmOptions,
  generatorOptions: GeneratorOptions,
  commandOptions?: CommandOptions
) => Promise<T>;

export type CommandOptions = {
  packageManager: PackageManagerName;
  usePnp?: boolean;
  type?: ProjectType;
  force?: any;
  html?: boolean;
  skipInstall?: boolean;
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
