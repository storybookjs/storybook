import { global } from '@storybook/global';

import { logger } from '@storybook/core/client-logger';

import { darken, lighten, rgba } from 'polished';

const { window: globalWindow } = global;

export const mkColor = (color: string) => ({ color });

// Check if it is a string. This is for the sake of warning users
// and the successive guarding logics that use String methods.
const isColorString = (color: string) => {
  if (typeof color !== 'string') {
    logger.warn(
      `Color passed to theme object should be a string. Instead ${color}(${typeof color}) was passed.`
    );
    return false;
  }

  return true;
};

// Passing arguments that can't be converted to RGB such as linear-gradient
// to library polished's functions such as lighten or darken throws the error
// that crashes the entire storybook. It needs to be guarded when arguments
// of those functions are from user input.
const isValidColorForPolished = (color: string) => {
  return !/(gradient|var|calc)/.test(color);
};

const applyPolished = (type: string, color: string) => {
  if (type === 'darken') {
    return rgba(`${darken(1, color)}`, 0.95);
  }

  if (type === 'lighten') {
    return rgba(`${lighten(1, color)}`, 0.95);
  }

  return color;
};

const colorFactory = (type: string) => (color: string) => {
  if (!isColorString(color)) {
    return color;
  }

  if (!isValidColorForPolished(color)) {
    return color;
  }

  // Guard anything that is not working with polished.
  try {
    return applyPolished(type, color);
  } catch (error) {
    return color;
  }
};

export const lightenColor = colorFactory('lighten');
export const darkenColor = colorFactory('darken');

// The default color scheme is light so unless the preferred color
// scheme is set to dark we always want to use the light theme
export const getPreferredColorScheme = () => {
  if (!globalWindow || !globalWindow.matchMedia) {
    return 'light';
  }

  const isDarkThemePreferred = globalWindow.matchMedia('(prefers-color-scheme: dark)').matches;

  if (isDarkThemePreferred) {
    return 'dark';
  }

  return 'light';
};
