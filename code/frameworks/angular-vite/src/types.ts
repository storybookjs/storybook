import type { CompatibleString } from 'storybook/internal/types';

import type { StorybookConfig as StorybookConfigBase } from 'storybook/internal/types';

import type { PropsTableMode } from '@storybook/angular-cm';
import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

type FrameworkName = CompatibleString<'@storybook/angular-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
  jit?: boolean;
  liveReload?: boolean;
  inlineStylesExtension?: string;
  tsconfig?: string;
  compodoc?: boolean;
  compodocArgs?: string[];
  /**
   * Which members the props table renders, as a ladder:
   *
   * - `all`: every member.
   * - `api`: the component's template-facing surface, meaning every declared input and output
   *   whatever its TypeScript visibility (Angular only honours access modifiers on bindings behind
   *   the opt-in `strictInputAccessModifiers`), plus the properties and methods that are not
   *   `private`, ES `#`, or carrying a JSDoc `internal` tag (a declared non-API).
   * - `inputs`: the inputs section alone.
   *
   * Tag a member `@ignore` to drop it whatever this says.
   *
   * `api` needs `features.experimentalDocgenServer`; without it only `all` and `inputs` apply.
   *
   * @default 'api'
   */
  propsTable?: PropsTableMode;
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
