import type { StorybookConfig, TypescriptOptions } from 'storybook/internal/types';

import type { DetectResult } from 'package-manager-detector';

import type { KnownPackagesList } from './get-known-packages';
import type { MonorepoType } from './get-monorepo-type';

export type EventType =
  | 'boot'
  | 'add'
  | 'dev'
  | 'build'
  | 'index'
  | 'upgrade'
  | 'multi-upgrade'
  | 'init'
  | 'init-step'
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
  | 'create-new-story-file-search'
  | 'open-in-editor'
  | 'testing-module-watch-mode'
  | 'testing-module-completed-report'
  | 'testing-module-crash-report'
  | 'addon-test'
  | 'test-run'
  | 'addon-onboarding'
  | 'onboarding-survey'
  | 'onboarding-checklist-muted'
  | 'onboarding-checklist-status'
  | 'mocking'
  | 'automigrate'
  | 'migrate'
  | 'preview-first-load'
  | 'doctor'
  | 'ghost-stories';
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
  userSince?: number;
  language: 'typescript' | 'javascript';
  framework?: {
    name?: string;
    options?: any;
  };
  builder?: string;
  renderer?: string;
  monorepo?: MonorepoType;
  packageManager?: {
    type: DetectResult['name'];
    version: DetectResult['version'];
    agent: DetectResult['agent'];
    nodeLinker: 'node_modules' | 'pnp' | 'pnpm' | 'isolated' | 'hoisted';
  };
  typescriptOptions?: Partial<TypescriptOptions>;
  addons?: Record<string, StorybookAddon>;
  storybookPackages?: Record<string, Dependency>;
  metaFramework?: {
    name: string;
    packageName: string;
    version: string;
  };
  knownPackages?: KnownPackagesList;
  hasRouterPackage?: boolean;
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
  applicationFileCount?: number;
};

export interface Payload {
  [key: string]: any;
}

export interface Context {
  [key: string]: any;
}

export interface Options {
  retryDelay: number;
  immediate: boolean;
  configDir?: string;
  enableCrashReports?: boolean;
  stripMetadata?: boolean;
  notify?: boolean;
}

export interface TelemetryData {
  eventType: EventType;
  payload: Payload;
  metadata?: StorybookMetadata;
}

export interface TelemetryEvent extends TelemetryData {
  eventId: string;
  sessionId: string;
  context: Context;
}

export interface InitPayload {
  projectType: string;
  features: { dev: boolean; docs: boolean; test: boolean; onboarding: boolean };
  newUser: boolean;
  versionSpecifier: string | undefined;
  cliIntegration: string | undefined;
}
