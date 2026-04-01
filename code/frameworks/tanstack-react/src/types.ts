import type { AnyRoute } from '@tanstack/react-router';
import type { CompatibleString } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';
import type { StorybookConfig as StorybookConfigReactVite } from '@storybook/react-vite';
import type { QueryParameters } from './query/types';
import type { RouterParameters } from './routing/types';

type FrameworkName = CompatibleString<'@storybook/tanstack-react'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
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

export interface TanStackPreviewOptions<TRoute extends AnyRoute | undefined = undefined> {
  /** TanStack Query configuration for stories */
  query?: QueryParameters;
  /** Router configuration for stories */
  router?: RouterParameters<TRoute>;
}

export interface TanStackParameters<TRoute extends AnyRoute | undefined = undefined> {
  /** TanStack framework configuration (router/query integration). */
  tanstack?: TanStackPreviewOptions<TRoute>;
}

export interface TanStackTypes<TRoute extends AnyRoute | undefined = undefined> {
  parameters: TanStackParameters<TRoute>;
}
