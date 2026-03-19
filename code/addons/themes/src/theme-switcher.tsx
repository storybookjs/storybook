import React from 'react';

import { Button, Select } from 'storybook/internal/components';

import { PaintBrushIcon } from '@storybook/icons';

import { addons, useAddonState, useChannel, useGlobals, useParameter } from 'storybook/manager-api';

import {
  DEFAULT_ADDON_STATE,
  DEFAULT_THEME_PARAMETERS,
  GLOBAL_KEY as KEY,
  PARAM_KEY,
  THEME_SWITCHER_ID,
  THEMING_EVENTS,
} from './constants';
import type { ThemesParameters as Parameters, ThemeAddonState } from './types';

type ThemesParameters = NonNullable<Parameters['themes']>;

const hasMultipleThemes = (themesList: ThemeAddonState['themesList']) => themesList.length > 1;
const hasTwoThemes = (themesList: ThemeAddonState['themesList']) => themesList.length === 2;

export const ThemeSwitcher = React.memo(function ThemeSwitcher() {
  const { themeOverride, disable } = useParameter<ThemesParameters>(
    PARAM_KEY,
    DEFAULT_THEME_PARAMETERS
  ) as ThemesParameters;
  const [{ theme: selected }, updateGlobals, storyGlobals] = useGlobals();

  const channel = addons.getChannel();
  const fromLast = channel.last(THEMING_EVENTS.REGISTER_THEMES);
  const initializeThemeState = Object.assign({}, DEFAULT_ADDON_STATE, {
    themesList: fromLast?.[0]?.themes || [],
    themeDefault: fromLast?.[0]?.defaultTheme || '',
  });

  const [{ themesList, themeDefault }, updateState] = useAddonState<ThemeAddonState>(
    THEME_SWITCHER_ID,
    initializeThemeState
  );

  const isLocked = KEY in storyGlobals || !!themeOverride;

  useChannel({
    [THEMING_EVENTS.REGISTER_THEMES]: ({ themes, defaultTheme }) => {
      updateState((state) => ({
        ...state,
        themesList: themes,
        themeDefault: defaultTheme,
      }));
    },
  });

  const currentTheme = selected || themeDefault;
  let ariaLabel = '';
  let label = '';
  let tooltip = '';
  if (isLocked) {
    label = 'Story override';
    ariaLabel = 'Theme set by story parameters';
    tooltip = 'Theme set by story parameters';
  } else if (currentTheme) {
    label = `${currentTheme} theme`;
    ariaLabel = 'Theme'; // it's Select's job to announce the current value.
    tooltip = 'Change theme';
  }

  if (disable) {
    return null;
  }

  if (hasTwoThemes(themesList)) {
    const alternateTheme = themesList.find((theme) => theme !== currentTheme);
    return (
      <Button
        ariaLabel={ariaLabel}
        tooltip={tooltip}
        variant="ghost"
        disabled={isLocked}
        key={THEME_SWITCHER_ID}
        onClick={() => {
          updateGlobals({ theme: alternateTheme });
        }}
      >
        <PaintBrushIcon />
        {label}
      </Button>
    );
  }

  if (hasMultipleThemes(themesList)) {
    return (
      <Select
        icon={<PaintBrushIcon />}
        ariaLabel={ariaLabel}
        disabled={isLocked}
        key={THEME_SWITCHER_ID}
        defaultOptions={currentTheme}
        options={themesList.map((theme) => ({
          title: theme,
          value: theme,
        }))}
        onSelect={(selected) => updateGlobals({ theme: selected })}
      >
        {label}
      </Select>
    );
  }

  return null;
});
