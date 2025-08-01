import type { NpmOptions } from '../../../../core/src/cli/NpmOptions';
import type {
  Builder,
  ProjectType,
  SupportedLanguage,
} from '../../../../core/src/cli/project_types';
import type {
  JsPackageManager,
  PackageManagerName,
} from '../../../../core/src/common/js-package-manager/JsPackageManager';
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
};

export interface FrameworkOptions {
  extraPackages?: string[] | ((details: { builder: Builder }) => Promise<string[]>);
  extraAddons?: string[];
  staticDir?: string;
  addScripts?: boolean;
  addMainFile?: boolean;
  addPreviewFile?: boolean;
  addComponents?: boolean;
  webpackCompiler?: ({ builder }: { builder: Builder }) => 'babel' | 'swc' | undefined;
  extraMain?: any;
  extensions?: string[];
  framework?: Record<string, any>;
  storybookConfigFolder?: string;
  componentsDestinationPath?: string;
  installFrameworkPackages?: boolean;
}

export type Generator<T = void> = (
  packageManagerInstance: JsPackageManager,
  npmOptions: NpmOptions,
  generatorOptions: GeneratorOptions,
  commandOptions?: CommandOptions
) => Promise<T>;

export type GeneratorFeature = 'docs' | 'test' | 'onboarding';

export type CommandOptions = {
  packageManager: PackageManagerName;
  usePnp?: boolean;
  features: GeneratorFeature[];
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
