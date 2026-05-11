import type { CompatibleString } from 'storybook/internal/types';

import type { StorybookConfig as StorybookConfigBase } from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/angular-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
  jit?: boolean;
  liveReload?: boolean;
  inlineStylesExtension?: string;
  tsconfig?: string;
  experimentalZoneless?: boolean;
};

type StorybookConfigFramework = {
  framework:
    | FrameworkName
    | {
        name: FrameworkName;
        options: FrameworkOptions;
      };
  core?: StorybookConfigBase['core'] & {
    builder?:
      | BuilderName
      | {
          name: BuilderName;
          options: BuilderOptions;
        };
  };
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigVite | keyof StorybookConfigFramework
> &
  StorybookConfigVite &
  StorybookConfigFramework;
