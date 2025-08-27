import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/svelte-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
  /**
   * Enable or disable automatic documentation generation for component properties, events, and
   * slots. When disabled, Storybook will skip the docgen processing step during build, which can
   * improve build performance.
   *
   * @default true
   */
  docgen?: boolean;
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
