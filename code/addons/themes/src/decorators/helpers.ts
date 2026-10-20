import type { StoryContext } from 'storybook/internal/types';

import { addons } from 'storybook/preview-api';

import { GLOBAL_KEY, THEMING_EVENTS } from '../constants.ts';

/**
 * @param StoryContext
 * @returns The global theme name set for your stories
 */
export function pluckThemeFromContext({ globals }: StoryContext): string {
  return globals[GLOBAL_KEY] || '';
}

export function initializeThemeState(themeNames: string[], defaultTheme: string) {
  addons.getChannel().emit(THEMING_EVENTS.REGISTER_THEMES, {
    defaultTheme,
    themes: themeNames,
  });
}
