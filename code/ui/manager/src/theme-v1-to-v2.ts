import type { ThemeVars } from '@storybook/theming';
import { css, themes } from '@storybook/theming';
import { transparentize } from 'polished';

export const isThemeDifferentFromDefaultTheme = (base: 'light' | 'dark', theme: ThemeVars) => {
  if (theme) {
    if (themes[base].base !== theme.base) return false;
    if (themes[base].colorPrimary !== theme.colorPrimary) return true;
    if (themes[base].colorSecondary !== theme.colorSecondary) return true;
    if (themes[base].appBg !== theme.appBg) return true;
    if (themes[base].appContentBg !== theme.appContentBg) return true;
    if (themes[base].appBorderColor !== theme.appBorderColor) return true;
    if (themes[base].appBorderRadius !== theme.appBorderRadius) return true;
    if (themes[base].fontBase !== theme.fontBase) return true;
    if (themes[base].fontCode !== theme.fontCode) return true;
    if (themes[base].textColor !== theme.textColor) return true;
    if (themes[base].textInverseColor !== theme.textInverseColor) return true;
    if (themes[base].textMutedColor !== theme.textMutedColor) return true;
    if (themes[base].barTextColor !== theme.barTextColor) return true;
    if (themes[base].barHoverColor !== theme.barHoverColor) return true;
    if (themes[base].barSelectedColor !== theme.barSelectedColor) return true;
    if (themes[base].buttonBg !== theme.buttonBg) return true;
    if (themes[base].buttonBorder !== theme.buttonBorder) return true;
    if (themes[base].booleanBg !== theme.booleanBg) return true;
    if (themes[base].booleanSelectedBg !== theme.booleanSelectedBg) return true;
    if (themes[base].inputBg !== theme.inputBg) return true;
    if (themes[base].inputBorder !== theme.inputBorder) return true;
    if (themes[base].inputTextColor !== theme.inputTextColor) return true;
    if (themes[base].inputBorderRadius !== theme.inputBorderRadius) return true;
  }
  return false;
};

export const convertThemeV1intoV2 = (theme: ThemeVars) => {
  return css`
    @media (prefers-color-scheme: light) {
      :root {
        /* Sidebar */
        --sb-sidebar-background: ${theme.appBg || themes.light.appBg};
        --sb-sidebar-borderRight: ${theme.appBorderColor || themes.light.appBorderColor};
        --sb-sidebar-sectionText: ${theme.textColor || themes.light.textColor};
        --sb-sidebar-sectionArrow: ${theme.textMutedColor || themes.light.textMutedColor};
        --sb-sidebar-sectionToggle: ${theme.textMutedColor || themes.light.textMutedColor};
        --sb-sidebar-itemArrow: ${theme.textMutedColor || themes.light.textMutedColor};
        --sb-sidebar-itemText: #2e3438;
        /* --sb-sidebar-itemIconDoc: #ffae00; This was a static color in v1 */
        /* --sb-sidebar-itemIconFolder: #6f2cac; This was a static color in v1 */
        /* --sb-sidebar-itemIconComponent: #029cfd; This was a static color in v1 */
        /* --sb-sidebar-itemIconStory: #37d5d3; This was a static color in v1 */
        --sb-sidebar-itemHoverBg: ${transparentize(0.93, theme.colorSecondary) ||
        transparentize(0.93, themes.light.colorSecondary)};
        --sb-sidebar-itemActiveBg: ${theme.colorSecondary || themes.light.colorSecondary};
        /* --sb-sidebar-itemActiveText: #fff; This was a static color in v1 */
        /* --sb-sidebar-itemActiveIcon: #fff; This was a static color in v1 */
        /* --sb-sidebar-itemActiveArrow: #fff; This was a static color in v1 */
        --sb-sidebar-searchBarBackground: ${theme.appBg || themes.light.appBg};
        --sb-sidebar-searchBarBorder: ${theme.appBorderColor || themes.light.appBorderColor};
        --sb-sidebar-searchPlaceholder: ${theme.textMutedColor || themes.light.textMutedColor};
        --sb-sidebar-searchIcon: ${theme.textMutedColor || themes.light.textMutedColor};

        /* Canvas */
        --sb-canvas-background: ${theme.appBg || themes.light.appBg};

        /* Addons toolbar */
        --sb-addonsToolbar-background: ${theme.appBg || themes.light.appBg};
        --sb-addonsToolbar-borderBottom: ${theme.appBorderColor || themes.light.appBorderColor};

        /* Addons panel */
        --sb-addonsPanel-headerBackground: ${theme.appBg || themes.light.appBg};
        --sb-addonsPanel-headerBorderTop: ${theme.appBorderColor || themes.light.appBorderColor};
        --sb-addonsPanel-headerBorderBottom: ${theme.appBorderColor || themes.light.appBorderColor};
        --sb-addonsPanel-headerActive: ${theme.colorSecondary || themes.light.colorSecondary};
        --sb-addonsPanel-headerText: ${theme.textColor || themes.light.textColor};
        --sb-addonsPanel-background: ${theme.appBg || themes.light.appBg};
        --sb-addonsPanel-border: ${theme.appBorderColor || themes.light.appBorderColor};
      }
    }
    @media (prefers-color-scheme: dark) {
      :root {
        /* Sidebar */
        --sb-sidebar-background: ${theme.appBg || themes.dark.appBg};
        --sb-sidebar-borderRight: ${theme.appBorderColor || themes.dark.appBorderColor};
        --sb-sidebar-sectionText: ${theme.textColor || themes.dark.textColor};
        --sb-sidebar-sectionArrow: ${theme.textMutedColor || themes.dark.textMutedColor};
        --sb-sidebar-sectionToggle: ${theme.textMutedColor || themes.dark.textMutedColor};
        --sb-sidebar-itemArrow: ${theme.textMutedColor || themes.dark.textMutedColor};
        --sb-sidebar-itemText: #2e3438;
        /* --sb-sidebar-itemIconDoc: #ffae00; This was a static color in v1 */
        /* --sb-sidebar-itemIconFolder: #6f2cac; This was a static color in v1 */
        /* --sb-sidebar-itemIconComponent: #029cfd; This was a static color in v1 */
        /* --sb-sidebar-itemIconStory: #37d5d3; This was a static color in v1 */
        --sb-sidebar-itemHoverBg: ${transparentize(0.93, theme.colorSecondary) ||
        transparentize(0.93, themes.dark.colorSecondary)};
        --sb-sidebar-itemActiveBg: ${theme.colorSecondary || themes.dark.colorSecondary};
        /* --sb-sidebar-itemActiveText: #fff; This was a static color in v1 */
        /* --sb-sidebar-itemActiveIcon: #fff; This was a static color in v1 */
        /* --sb-sidebar-itemActiveArrow: #fff; This was a static color in v1 */
        --sb-sidebar-searchBarBackground: ${theme.appBg || themes.dark.appBg};
        --sb-sidebar-searchBarBorder: ${theme.appBorderColor || themes.dark.appBorderColor};
        --sb-sidebar-searchPlaceholder: ${theme.textMutedColor || themes.dark.textMutedColor};
        --sb-sidebar-searchIcon: ${theme.textMutedColor || themes.dark.textMutedColor};

        /* Canvas */
        --sb-canvas-background: ${theme.appBg || themes.dark.appBg};

        /* Addons toolbar */
        --sb-addonsToolbar-background: ${theme.appBg || themes.dark.appBg};
        --sb-addonsToolbar-borderBottom: ${theme.appBorderColor || themes.dark.appBorderColor};

        /* Addons panel */
        --sb-addonsPanel-headerBackground: ${theme.appBg || themes.dark.appBg};
        --sb-addonsPanel-headerBorderTop: ${theme.appBorderColor || themes.dark.appBorderColor};
        --sb-addonsPanel-headerBorderBottom: ${theme.appBorderColor || themes.dark.appBorderColor};
        --sb-addonsPanel-headerActive: ${theme.colorSecondary || themes.dark.colorSecondary};
        --sb-addonsPanel-headerText: ${theme.textColor || themes.dark.textColor};
        --sb-addonsPanel-background: ${theme.appBg || themes.dark.appBg};
        --sb-addonsPanel-border: ${theme.appBorderColor || themes.dark.appBorderColor};
      }
    }
  `;
};
