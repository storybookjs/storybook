import type { CompatibleString } from 'storybook/internal/types';

import type {
  BuilderOptions,
  StorybookConfigWebpack,
  TypescriptOptions as TypescriptOptionsBuilder,
} from '@storybook/builder-webpack5';
import type {
  ReactOptions,
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsReact,
} from '@storybook/preset-react-webpack';

import type * as NextImage from 'next/image';
import type { NextRouter } from 'next/router';

type FrameworkName = CompatibleString<'@storybook/nextjs'>;
type BuilderName = CompatibleString<'@storybook/builder-webpack5'>;

export type FrameworkOptions = ReactOptions & {
  nextConfigPath?: string;
  image?: Partial<NextImage.ImageProps>;
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
  typescript?: Partial<TypescriptOptionsBuilder & TypescriptOptionsReact> &
    StorybookConfigBase['typescript'];
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigWebpack | keyof StorybookConfigFramework
> &
  StorybookConfigWebpack &
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
