import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

import '../libs/storybook/src/addons/feature-flags/panel';

const lightTheme = create({
  base: 'light',
  //logo and Title
  brandTitle: 'Bitwarden Component Library',
  brandUrl: '/',
  brandImage:
    'https://github.com/bitwarden/brand/blob/51942f8d6e55e96a078a524e0f739efbf1997bcf/logos/logo-horizontal-blue.png?raw=true',
  brandTarget: '_self',

  //Colors
  colorPrimary: '#6D757E',
  colorSecondary: '#175DDC',

  // UI
  appBg: '#f9fBff',
  appContentBg: '#ffffff',
  appBorderColor: '#CED4DC',

  // Text colors
  textColor: '#212529',
  textInverseColor: '#ffffff',

  // Toolbar default and active colors
  barTextColor: '#6D757E',
  barSelectedColor: '#175DDC',
  barBg: '#ffffff',

  // Form colors
  inputBg: '#ffffff',
  inputBorder: '#6D757E',
  inputTextColor: '#6D757E',
});

const darkTheme = create({
  base: 'dark',

  //logo and Title
  brandTitle: 'Bitwarden Component Library',
  brandUrl: '/',
  brandImage:
    'https://github.com/bitwarden/brand/blob/51942f8d6e55e96a078a524e0f739efbf1997bcf/logos/logo-horizontal-white.png?raw=true',
  brandTarget: '_self',

  //Colors
  colorSecondary: '#6A99F0',
  barSelectedColor: '#6A99F0',
});

export const getPreferredColorScheme = () => {
  if (!globalThis || !globalThis.matchMedia) {
    return 'light';
  }

  const isDarkThemePreferred = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  if (isDarkThemePreferred) {
    return 'dark';
  }

  return 'light';
};

addons.setConfig({
  theme: getPreferredColorScheme() === 'dark' ? darkTheme : lightTheme,
});
