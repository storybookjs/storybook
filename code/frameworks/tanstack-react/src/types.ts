import type { CompatibleString } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';
import type { StorybookConfig as StorybookConfigReactVite } from '@storybook/react-vite';

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

export interface TanStackPreviewOptions {}

export interface TanStackParameters {
  /** TanStack framework configuration (router/query integration). */
  tanstack?: TanStackPreviewOptions;
}

export interface TanStackTypes {
  parameters: TanStackParameters;
}
