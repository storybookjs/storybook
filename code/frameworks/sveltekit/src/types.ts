import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

import type {
  goto,
  invalidate,
  invalidateAll,
  pushState,
  refreshAll,
  replaceState,
} from './mocks/app/navigation.ts';

type FrameworkName = CompatibleString<'@storybook/sveltekit'>;
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

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1102-L1143}
 */
interface Page<
  Params extends Record<string, string> = Record<string, string>,
  RouteId extends string | null = string | null,
> {
  url: URL;
  params: Params;
  route: {
    id: RouteId;
  };
  status: number;
  error: ({ message: string } & Record<string, any>) | null;
  data: Record<string, any>;
  state: Record<string, any>;
  form: any;
}

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L988}
 */
interface NavigationTarget {
  params: Record<string, string> | null;
  route: {
    id: string | null;
  };
  url: URL;
}

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1017C9-L1017C89}
 */
type NavigationType = 'enter' | 'form' | 'leave' | 'link' | 'goto' | 'popstate';

/**
 * Copied from:
 * {@link https://github.com/sveltejs/kit/blob/7bb41aa4263b057a8912f4cdd35db03755d37342/packages/kit/types/index.d.ts#L1017C9-L1017C89}
 */
interface Navigation {
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  type: Exclude<NavigationType, 'enter'>;
  willUnload: boolean;
  delta?: number;
  complete: Promise<void>;
}

// The mocks ignore what a callback returns.
type MockOf<F extends (...args: any[]) => unknown> = (...args: Parameters<F>) => void;

export type SvelteKitParameters = Partial<{
  hrefs: Record<string, HrefConfig>;
  state: Partial<{
    page: Partial<Page>;
    navigating: Partial<Navigation>;
    updated: { current: boolean };
  }>;
  navigation: Partial<{
    goto: MockOf<typeof goto>;
    invalidate: MockOf<typeof invalidate>;
    invalidateAll: MockOf<typeof invalidateAll>;
    refreshAll: MockOf<typeof refreshAll>;
    pushState: MockOf<typeof pushState>;
    replaceState: MockOf<typeof replaceState>;
    afterNavigate: Record<string, any>;
  }>;
  forms: Partial<{
    enhance: (event: SubmitEvent) => void;
  }>;
}>;

export interface SvelteKitTypes {
  parameters: {
    /** Mocks for the SvelteKit modules, such as `$app/state` and `$app/navigation`. */
    sveltekit_experimental?: SvelteKitParameters;
  };
}
