import React, { Fragment, useMemo } from 'react';
import {
  useAddonState,
  useChannel,
  useGlobals,
  useParameter,
  addons,
} from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';
import { IconButton, WithTooltip, TooltipLinkList } from 'storybook/internal/components';

import { PaintBrushIcon } from '@storybook/icons';
import type { ThemeAddonState, ThemeParameters } from './constants';
import {
  PARAM_KEY,
  THEME_SWITCHER_ID,
  THEMING_EVENTS,
  DEFAULT_ADDON_STATE,
  DEFAULT_THEME_PARAMETERS,
} from './constants';

const IconButtonLabel = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
}));

const hasMultipleThemes = (themesList: ThemeAddonState['themesList']) => themesList.length > 1;
const hasTwoThemes = (themesList: ThemeAddonState['themesList']) => themesList.length === 2;

export const ThemeSwitcher = React.memo(function ThemeSwitcher() {
  const { themeOverride } = useParameter<ThemeParameters>(
    PARAM_KEY,
    DEFAULT_THEME_PARAMETERS
  ) as ThemeParameters;
  const [{ theme: selected }, updateGlobals] = useGlobals();

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

  useChannel({
    [THEMING_EVENTS.REGISTER_THEMES]: ({ themes, defaultTheme }) => {
      updateState((state) => ({
        ...state,
        themesList: themes,
        themeDefault: defaultTheme,
      }));
    },
  });

  const label = useMemo(() => {
    if (themeOverride) {
      return <>Story override</>;
    }

    const themeName = selected || themeDefault;

    return themeName && <>{`${themeName} theme`}</>;
  }, [themeOverride, themeDefault, selected]);

  if (hasTwoThemes(themesList)) {
    const currentTheme = selected || themeDefault;
    const alternateTheme = themesList.find((theme) => theme !== currentTheme);
    return (
      <IconButton
        key={THEME_SWITCHER_ID}
        active={!themeOverride}
        title="Theme"
        onClick={() => {
          updateGlobals({ theme: alternateTheme });
        }}
      >
        <PaintBrushIcon />
        {label && <IconButtonLabel>{label}</IconButtonLabel>}
      </IconButton>
    );
  }

  if (hasMultipleThemes(themesList)) {
    return (
      <Fragment>
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
          <IconButton key={THEME_SWITCHER_ID} active={!themeOverride} title="Theme">
            <PaintBrushIcon />
            {label && <IconButtonLabel>{label}</IconButtonLabel>}
          </IconButton>
        </WithTooltip>
      </Fragment>
    );
  }

  return null;
});
