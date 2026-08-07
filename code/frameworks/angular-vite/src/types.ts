import type { CompatibleString } from 'storybook/internal/types';

import type { StorybookConfig as StorybookConfigBase } from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/angular-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

/**
 * Shape of the server-side story snippet.
 *
 * `template` emits the bare markup, which is what the browser generator has always produced.
 * `component` wraps it in the standalone host component it needs to compile, so the snippet can be
 * pasted into a project or handed to an agent as-is.
 */
export type SnippetFormat = 'template' | 'component';

export type FrameworkOptions = {
  builder?: BuilderOptions;
  jit?: boolean;
  liveReload?: boolean;
  inlineStylesExtension?: string;
  tsconfig?: string;
  compodoc?: boolean;
  compodocArgs?: string[];
  /** Only read when `features.experimentalDocgenServer` is on. Defaults to `'template'`. */
  snippetFormat?: SnippetFormat;
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
