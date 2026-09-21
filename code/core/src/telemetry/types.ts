import type { StorybookConfig, TypescriptOptions } from 'storybook/internal/types';

import type { DetectResult } from 'package-manager-detector';

import type { MonorepoType } from '../shared/utils/get-monorepo-type.ts';
import type { AgentInfo } from './detect-agent.ts';
import type { KnownPackagesList } from './get-known-packages.ts';

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
  | 'exit'
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
  | 'review'
  | 'share'
  | 'ghost-stories'
  | 'sidebar-filter'
  | 'tools-command'
  | 'skills-get'
  | 'ai-command'
  | 'ai-init-opt-in'
  | 'ai-prompt-nudge'
  | 'ai-setup'
  | 'ai-setup-final-scoring'
  | 'ai-setup-self-healing-scoring';
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
  /** If we can identify the agent, report it; otherwise `unknown` when detected heuristically. */
  agent?: AgentInfo;
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
    nodeLinker: NodeLinker;
  };
  typescriptOptions?: Partial<TypescriptOptions>;
  addons?: Record<string, StorybookAddon>;
  storybookPackages?: Record<string, Dependency>;
  metaFramework?: {
    name: string;
    packageName: string;
    version: string;
  };
  packageJsonType?: 'unknown' | 'module' | 'commonjs';
  knownPackages?: KnownPackagesList;
  hasRouterPackage?: boolean;
  hasStorybookEslint?: boolean;
  hasStaticDirs?: boolean;
  /**
   * Whether the project customizes webpack — through `webpackFinal` in the Storybook config, or
   * (for Next.js projects) through the `webpack` option of `next.config.*`.
   */
  hasCustomWebpack?: boolean;
  /** Whether the Storybook config defines `viteFinal`. */
  hasCustomVite?: boolean;
  hasCustomBabel?: boolean;
  /**
   * Whether a Next.js project's scripts opt into Turbopack via an explicit `--turbopack` /
   * `--webpack` flag. `undefined` when no such flag is present (ambiguous from Next.js 16
   * onwards, where Turbopack is the default) or when the project isn't using Next.js.
   */
  hasTurbopack?: boolean;
  /**
   * Whether the project has a Module Federation package installed (e.g. `@module-federation/*`
   * or `@originjs/vite-plugin-federation`). This can't detect projects that configure webpack's
   * built-in `ModuleFederationPlugin` directly without one of these packages.
   */
  hasModuleFederation?: boolean;
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

export type PayloadFactory = () => Payload | Promise<Payload>;

export type PayloadInput = Payload | PayloadFactory;

export interface Context {
  [key: string]: any;
}

export type YarnNodeLinker = 'node-modules' | 'pnp' | 'pnpm';

export type PnpmNodeLinker = 'isolated' | 'hoisted' | 'pnp';

// node_modules is Storybook's label for package managers without a linker setting, distinct from
// Yarn Berry's node-modules so the telemetry data stays comparable over time.
export type NodeLinker = 'node_modules' | YarnNodeLinker | PnpmNodeLinker;

export interface Options {
  retryDelay: number;
  immediate: boolean;
  configDir?: string;
  enableCrashReports?: boolean;
  stripMetadata?: boolean;
  notify?: boolean;
  /** Override the event timestamp. Used when flushing queued events to preserve original timing. */
  timestamp?: number;
  /** When true, bypass the disabled state. Used for error telemetry with enableCrashReports. */
  force?: boolean;
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
  features: {
    dev: boolean;
    docs: boolean;
    test: boolean;
    onboarding: boolean;
    ai: boolean;
  };
  newUser: boolean;
  versionSpecifier: string | undefined;
  cliIntegration: string | undefined;
}
