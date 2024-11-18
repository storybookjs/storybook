import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/experimental-nextjs-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  /** The path to the Next.js configuration file. */
  nextConfigPath?: string;
  builder?: BuilderOptions;
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
  StorybookConfigFramework &
  // TODO: check if unknown is better than {}
  unknown;
