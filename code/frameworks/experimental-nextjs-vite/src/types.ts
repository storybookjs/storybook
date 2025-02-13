import type { CompatibleString } from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';
import type { StorybookConfig as StorybookConfigReactVite } from '@storybook/react-vite';

import type { NextRouter } from 'next/router';

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

export interface NextJsParameters {
  /**
   * Next.js framework configuration
   *
   * @see https://storybook.js.org/docs/get-started/frameworks/nextjs
   */
  nextjs?: {
    /**
     * Enable App Directory features If your story imports components that use next/navigation, you
     * need to set this parameter to true
     */
    appDirectory?: boolean;

    /**
     * Next.js navigation configuration when using `next/navigation`. Please note that it can only
     * be used in components/pages in the app directory.
     */
    navigation?: NextRouter;

    /** Next.js router configuration */
    router?: NextRouter;
  };
}
