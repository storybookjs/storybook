import type { CompatibleString } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';
import type { StorybookConfig as StorybookConfigReactVite } from '@storybook/react-vite';

import type { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import type { AnyRouter, Router, RouterHistory, RouterOptions } from '@tanstack/react-router';

type FrameworkName = CompatibleString<'@storybook/tanstack-react'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  /** Optional Vite server overrides applied via the preset. */
  server?: NonNullable<StorybookConfigReactVite['viteFinal']> extends (
    config: infer C,
    options: any
  ) => any
    ? C['server']
    : unknown;
  /** Builder options passed through to @storybook/builder-vite. */
  builder?: BuilderOptions;
};

type StorybookConfigFramework = {
  framework:
    | FrameworkName
    | {
        name: FrameworkName;
        options: FrameworkOptions;
      };
  core?: StorybookConfigReactVite['core'] & {
    builder?:
      | BuilderName
      | {
          name: BuilderName;
          options: BuilderOptions;
        };
  };
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<StorybookConfigReactVite, keyof StorybookConfigFramework> &
  StorybookConfigFramework;

export type TanStackRouterMode = 'story' | 'routeTree' | 'instance';

export interface TanStackRouterOptions {
  /**
   * Provide a Router instance; if omitted, the framework can create a simple in-memory router when
   * enabled.
   */
  instance?: Router<any>;
  /**
   * Provide a pre-built route tree; if set, the framework will create a router using the supplied
   * history (or in-memory history by default).
   */
  routeTree?: AnyRouter['routeTree'];
  history?: RouterHistory;
  /**
   * Controls how the framework creates or uses a router:
   *
   * - 'instance' -> use the provided `instance`
   * - 'routeTree' -> build a router from `routeTree`
   * - 'story' -> wrap the story element in a minimal router (default)
   */
  mode?: TanStackRouterMode;
  /** Enable the built-in in-memory router wrapper. */
  enabled?: boolean;
  /**
   * Initial entries used when creating the in-memory router. Ignored if a custom history is
   * supplied.
   */
  initialEntries?: string[];
  /** Initial index used when creating the in-memory router. Ignored if a custom history is supplied. */
  initialIndex?: number;
  /** Optional path for the generated story route when in `story` mode. Defaults to '/'. */
  storyPath?: string;
  /** Default search params applied when the router is created. */
  defaultSearch?: Record<string, unknown>;
  /** Default path params applied when the router is created (mostly useful with `initialEntries`). */
  defaultParams?: Record<string, unknown>;
  /**
   * Context passed to `createRouter` when the framework builds the router (routeTree or story
   * mode).
   */
  context?: RouterOptions['context'];
  /**
   * Advanced escape hatch: supply a custom factory for creating the router. The framework will
   * still compute routeTree/history/context and pass them through.
   */
  createRouter?: (options: RouterOptions<any>) => Router<any>;
}

export interface TanStackPreviewOptions {
  router?: TanStackRouterOptions;
  queryClient?: QueryClient;
  queryClientConfig?: QueryClientConfig;
}

export interface TanStackParameters {
  /** TanStack framework configuration (router/query integration). */
  tanstack?: TanStackPreviewOptions;
}

export interface TanStackTypes {
  parameters: TanStackParameters;
}
