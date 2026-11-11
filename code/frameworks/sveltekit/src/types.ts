import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/sveltekit'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
  /**
   * Enable or disable automatic documentation generation for component properties, events, and
   * slots. When disabled, Storybook will skip the docgen processing step during build, which can
   * improve build performance.
   *
   * @deprecated Builder docgen is removed in Storybook 12. Use `features.docgenServer`.
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

export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigVite | keyof StorybookConfigFramework
> &
  StorybookConfigVite &
  StorybookConfigFramework;

export interface SvelteKitTypes {
  parameters: {
    /**
     * Removed in Storybook 11. Mock the SvelteKit modules in `beforeEach` instead.
     *
     * @deprecated See https://storybook.js.org/docs/get-started/frameworks/sveltekit#mocking-modules
     */
    sveltekit_experimental?: never;
  };
}
