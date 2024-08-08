import type { StorybookConfig, TypescriptOptions } from '@storybook/core/types';
import type { PM } from 'detect-package-manager';

import type { MonorepoType } from './get-monorepo-type';

export type EventType =
  | 'boot'
  | 'dev'
  | 'build'
  | 'upgrade'
  | 'init'
  | 'scaffolded-empty'
  | 'browser'
  | 'canceled'
  | 'error'
  | 'error-metadata'
  | 'version-update'
  | 'core-config'
  | 'remove'
  | 'save-story'
  | 'create-new-story-file'
  | 'create-new-story-file-search';

export interface Dependency {
  version: string | undefined;
  versionSpecifier?: string;
}

export interface StorybookAddon extends Dependency {
  options: any;
}

export type StorybookMetadata = {
  storybookVersion?: string;
  storybookVersionSpecifier: string;
  generatedAt?: number;
  language: 'typescript' | 'javascript';
  framework?: {
    name: string;
    options?: any;
  };
  builder?: string;
  renderer?: string;
  monorepo?: MonorepoType;
  packageManager?: {
    type: PM;
    version: string;
  };
  typescriptOptions?: Partial<TypescriptOptions>;
  addons?: Record<string, StorybookAddon>;
  storybookPackages?: Record<string, Dependency>;
  metaFramework?: {
    name: string;
    packageName: string;
    version: string;
  };
  testPackages?: Record<string, string | undefined>;
  hasStorybookEslint?: boolean;
  hasStaticDirs?: boolean;
  hasCustomWebpack?: boolean;
  hasCustomBabel?: boolean;
  features?: StorybookConfig['features'];
  refCount?: number;
  preview?: {
    usesGlobals?: boolean;
  };
  portableStoriesFileCount?: number;
};

export interface Payload {
  [key: string]: any;
}

export interface Options {
  retryDelay: number;
  immediate: boolean;
  configDir?: string;
  enableCrashReports?: boolean;
  stripMetadata?: boolean;
}

export interface TelemetryData {
  eventType: EventType;
  payload: Payload;
  metadata?: StorybookMetadata;
}
