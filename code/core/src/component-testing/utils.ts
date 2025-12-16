import Filter from 'ansi-to-html';
import { type StorybookTheme, useTheme } from 'storybook/theming';
// eslint-disable-next-line depend/ban-dependencies
import stripAnsi from 'strip-ansi';

import type { API_StoryEntry } from 'storybook/internal/types';

import { PARAM_KEY } from './constants';

export function isInteractionsDisabled(
  parameters: API_StoryEntry['parameters']
): boolean {
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
  return new Filter({
    escapeXML: true,
    fg: theme.color.defaultText,
    bg: theme.background.content,
  });
}

export function useAnsiToHtmlFilter() {
  const theme = useTheme();
  return createAnsiToHtmlFilter(theme);
}
