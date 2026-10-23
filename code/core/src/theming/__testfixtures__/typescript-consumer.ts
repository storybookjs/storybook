import { create, themes, type ThemeVars, type ThemeVarsPartial } from 'storybook/theming';
// @ts-expect-error styled is exported from storybook/theming/emotion
import { styled as createStyled } from 'storybook/theming';
import { styled, useTheme, type Color } from 'storybook/theming/emotion';

const partial: ThemeVarsPartial = { base: 'light', colorPrimary: 'red' };
const theme: ThemeVars = create(partial);
const preset: ThemeVars = themes.dark;

const Button = styled.button(({ theme: buttonTheme }) => {
  const color: Color = buttonTheme.color;
  return { color: color.mediumdark };
});

export function readTheme(): Color {
  return useTheme().color;
}

void theme.colorPrimary;
void preset.colorPrimary;
void Button;
void createStyled;
