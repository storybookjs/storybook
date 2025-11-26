import type { ThemeAddonState, ThemesParameters } from './types';

export const PARAM_KEY = 'themes' as const;
export const ADDON_ID = `storybook/${PARAM_KEY}` as const;
export const GLOBAL_KEY = 'theme' as const;
export const THEME_SWITCHER_ID = `${ADDON_ID}/theme-switcher` as const;

export const DEFAULT_ADDON_STATE: ThemeAddonState = {
  themesList: [],
  themeDefault: undefined,
};

export const DEFAULT_THEME_PARAMETERS: ThemesParameters['themes'] = {};

export const THEMING_EVENTS = {
  REGISTER_THEMES: `${ADDON_ID}/REGISTER_THEMES`,
} as const;
