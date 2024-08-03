import { addons, useParameter } from 'storybook/internal/preview-api';
import type { StoryContext } from 'storybook/internal/types';
import type { ThemeParameters } from '../constants';
import { GLOBAL_KEY, PARAM_KEY, THEMING_EVENTS, DEFAULT_THEME_PARAMETERS } from '../constants';

/**
 *
 * @param StoryContext
 * @returns The global theme name set for your stories
 */
export function pluckThemeFromContext({ globals }: StoryContext): string {
  return globals[GLOBAL_KEY] || '';
}

export function useThemeParameters(): ThemeParameters {
  return useParameter<ThemeParameters>(PARAM_KEY, DEFAULT_THEME_PARAMETERS) as ThemeParameters;
}

export function initializeThemeState(themeNames: string[], defaultTheme: string) {
  addons.getChannel().emit(THEMING_EVENTS.REGISTER_THEMES, {
    defaultTheme,
    themes: themeNames,
  });
}
