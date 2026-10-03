import type { Decorator } from '@storybook/svelte';

import StylexTheme from './StylexTheme.svelte';

/** Applies a `createTheme` theme from the `stylexTheme` global, or `parameters.stylexTheme`. */
export const withStylexTheme: Decorator = (_, { globals, parameters }) => ({
  Component: StylexTheme,
  props: { theme: parameters.stylexTheme ?? globals.stylexTheme ?? 'light' },
});
