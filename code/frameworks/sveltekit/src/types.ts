import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

import type { enhance } from './mocks/app/forms';
import type { goto, invalidate, invalidateAll } from './mocks/app/navigation';
import type { Navigation, Page } from './mocks/app/state.svelte';

type FrameworkName = CompatibleString<'@storybook/sveltekit'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
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

export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigVite | keyof StorybookConfigFramework
> &
  StorybookConfigVite &
  StorybookConfigFramework;

export type NormalizedHrefConfig = {
  callback: (to: string, event: Event) => void;
  asRegex?: boolean;
};

export type HrefConfig = NormalizedHrefConfig | NormalizedHrefConfig['callback'];

export type SvelteKitParameters = Partial<{
  hrefs: Record<string, HrefConfig>;
  state: {
    page: Partial<Page>;
    navigating: Partial<Navigation>;
    updated: { current: boolean };
  };
  /**
   * @deprecated
   * @see {@link https://svelte.dev/docs/kit/$app-stores}
   */
  stores: {
    page: Record<string, any>;
    navigating: Record<string, any>;
    updated: boolean;
  };
  navigation: {
    goto: typeof goto;
    invalidate: typeof invalidate;
    invalidateAll: typeof invalidateAll;
    afterNavigate: Record<string, any>;
  };
  forms: {
    enhance: typeof enhance;
  };
}>;
