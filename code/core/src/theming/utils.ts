import { global } from '@storybook/global';

import { logger } from '@storybook/core/client-logger';

import {
  darken,
  lighten,
  opacify as polishedOpacify,
  transparentize as polishedTransparentize,
  rgba,
} from 'polished';

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

const safelyRunPolished = (color: string, f: () => string): string => {
  if (!isColorString(color)) {
    return color;
  }

  if (!isValidColorForPolished(color)) {
    return color;
  }

  try {
    return f();
  } catch (_error) {
    return color;
  }
};

/**
 * Returns a string value for the lighted color.
 *
 * This wrapper function calls `lighten` function imported from "polished". Differences from the
 * imported function:
 *
 * - Does not support curried usage.
 * - Does not throw when `color` is not valid color string.
 *
 * @param amount - Between 0 to 1.
 */
export function lightenColor(amount: number | string, color: string): string;
/**
 * Returns a lighted and slightly translucent color.
 *
 * This overload is kept for compatibility reasons. Use another overload signature instead.
 */
export function lightenColor(color: string): string;
export function lightenColor(...args: [number | string, string] | [string]): string {
  if (args.length === 1) {
    return safelyRunPolished(args[0], () => rgba(`${lighten(1, args[0])}`, 0.95));
  }

  return safelyRunPolished(args[1], () => lighten(args[0], args[1]));
}

/**
 * Returns a string value for the darkened color.
 *
 * This wrapper function calls `darken` function imported from "polished". Differences from the
 * imported function:
 *
 * - Does not support curried usage.
 * - Does not throw when `color` is not valid color string.
 *
 * @param amount - Between 0 to 1.
 */
export function darkenColor(amount: number | string, color: string): string;
/**
 * Returns a darkened and slightly translucent color.
 *
 * This overload is kept for compatibility reasons. Use another overload signature instead.
 */
export function darkenColor(color: string): string;
export function darkenColor(...args: [number | string, string] | [string]): string {
  if (args.length === 1) {
    return safelyRunPolished(args[0], () => rgba(`${darken(1, args[0])}`, 0.95));
  }

  return safelyRunPolished(args[1], () => darken(args[0], args[1]));
}

/**
 * Decrease the opacity of a color.
 *
 * This wrapper function calls `transparentize` function imported from "polished". Differences from
 * the imported function:
 *
 * - Does not support curried usage.
 * - Does not throw when `color` is not valid color string.
 *
 * @param amount - Between 0 to 1.
 */
export const transparentize = (amount: number | string, color: string): string => {
  return safelyRunPolished(color, () => polishedTransparentize(amount, color));
};

/**
 * Increase the opacity of a color.
 *
 * This wrapper function calls `opacify` function imported from "polished". Differences from the
 * imported function:
 *
 * - Does not support curried usage.
 * - Does not throw when `color` is not valid color string.
 *
 * @param amount - Between 0 to 1.
 */
export const opacify = (amount: number | string, color: string): string => {
  return safelyRunPolished(color, () => polishedOpacify(amount, color));
};

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
