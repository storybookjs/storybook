import type { CompatibleString } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';
import type { StorybookConfig as StorybookConfigReactVite } from '@storybook/react-vite';

import type { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import type { AnyRouter, Router, RouterHistory } from '@tanstack/react-router';

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
  /** Enable the built-in in-memory router wrapper. */
  enabled?: boolean;
  /** Initial entries used when creating the in-memory router. */
  initialEntries?: string[];
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
