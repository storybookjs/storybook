import type { API_StoryEntry } from '@storybook/core/internal/types';

import { createAnsiConverter } from '@storybook/core/internal/deep/utils/ansi-converter';
import { type StorybookTheme, useTheme } from '@storybook/ui/theming';
// eslint-disable-next-line depend/ban-dependencies
import stripAnsi from 'strip-ansi';

import { PARAM_KEY } from './constants.ts';

export function isInteractionsDisabled(parameters: API_StoryEntry['parameters']): boolean {
  return !!parameters?.[PARAM_KEY]?.disable;
}

export function isTestAssertionError(error: unknown) {
  return isChaiError(error) || isJestError(error);
}

export function isChaiError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    typeof error.name === 'string' &&
    error.name === 'AssertionError'
  );
}

export function isJestError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    stripAnsi(error.message).startsWith('expect(')
  );
}

export function createAnsiToHtmlFilter(theme: StorybookTheme) {
  return createAnsiConverter({
    escapeXML: true,
    fg: theme.color.defaultText,
    bg: theme.background.content,
  });
}

export function useAnsiToHtmlFilter() {
  const theme = useTheme();
  return createAnsiToHtmlFilter(theme);
}
