import { addons } from 'storybook/internal/preview-api';
import type { StoryContext } from 'storybook/internal/types';

import type { ThemeParameters } from '../constants';
import { DEFAULT_THEME_PARAMETERS, GLOBAL_KEY, PARAM_KEY, THEMING_EVENTS } from '../constants';

/**
 * @param StoryContext
 * @returns The global theme name set for your stories
 */
export function pluckThemeFromContext({ globals }: StoryContext): string {
  return globals[GLOBAL_KEY] || '';
}

export function useThemeParameters(context: StoryContext): ThemeParameters {
  return context.parameters[PARAM_KEY] || DEFAULT_THEME_PARAMETERS;
}

export function initializeThemeState(themeNames: string[], defaultTheme: string) {
  addons.getChannel().emit(THEMING_EVENTS.REGISTER_THEMES, {
    defaultTheme,
    themes: themeNames,
  });
}
