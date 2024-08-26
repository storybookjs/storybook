// eslint-disable-next-line import/no-extraneous-dependencies
import React from 'react';

import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import {
  addons,
  useAddonState,
  useChannel,
  useGlobals,
  useParameter,
} from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { PaintBrushIcon } from '@storybook/icons';

import type { ThemeAddonState, ThemeParameters } from './constants';
import {
  DEFAULT_ADDON_STATE,
  DEFAULT_THEME_PARAMETERS,
  GLOBAL_KEY as KEY,
  PARAM_KEY,
  THEME_SWITCHER_ID,
  THEMING_EVENTS,
} from './constants';

const IconButtonLabel = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
}));

const hasMultipleThemes = (themesList: ThemeAddonState['themesList']) => themesList.length > 1;
const hasTwoThemes = (themesList: ThemeAddonState['themesList']) => themesList.length === 2;

export const ThemeSwitcher = React.memo(function ThemeSwitcher() {
  const { themeOverride, disable } = useParameter<ThemeParameters>(
    PARAM_KEY,
    DEFAULT_THEME_PARAMETERS
  ) as ThemeParameters;
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

  const themeName = selected || themeDefault;
  let label = '';
  if (isLocked) {
    label = 'Story override';
  } else if (themeName) {
    label = `${themeName} theme`;
  }

  if (disable) {
    return null;
  }

  if (hasTwoThemes(themesList)) {
    const currentTheme = selected || themeDefault;
    const alternateTheme = themesList.find((theme) => theme !== currentTheme);
    return (
      <IconButton
        disabled={isLocked}
        key={THEME_SWITCHER_ID}
        active={!themeOverride}
        title="Theme"
        onClick={() => {
          updateGlobals({ theme: alternateTheme });
        }}
      >
        <PaintBrushIcon />
        {label ? <IconButtonLabel>{label}</IconButtonLabel> : null}
      </IconButton>
    );
  }

  if (hasMultipleThemes(themesList)) {
    return (
      <WithTooltip
        placement="top"
        trigger="click"
        closeOnOutsideClick
        tooltip={({ onHide }) => {
          return (
            <TooltipLinkList
              links={themesList.map((theme) => ({
                id: theme,
                title: theme,
                active: selected === theme,
                onClick: () => {
                  updateGlobals({ theme });
                  onHide();
                },
              }))}
            />
          );
        }}
      >
        <IconButton
          key={THEME_SWITCHER_ID}
          active={!themeOverride}
          title="Theme"
          disabled={isLocked}
        >
          <PaintBrushIcon />
          {label && <IconButtonLabel>{label}</IconButtonLabel>}
        </IconButton>
      </WithTooltip>
    );
  }

  return null;
});
