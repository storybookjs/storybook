import { type StorybookTheme, useTheme } from 'storybook/internal/theming';

import Filter from 'ansi-to-html';
import stripAnsi from 'strip-ansi';

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
