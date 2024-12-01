import type { Args } from '@storybook/core/types';

import { once } from '@storybook/core/client-logger';

import { isPlainObject } from 'es-toolkit';
import { type Options, parse } from 'picoquery';
import { dedent } from 'ts-dedent';

// Keep this in sync with validateArgs in router/src/utils.ts
const VALIDATION_REGEXP = /^[a-zA-Z0-9 _-]*$/;
const NUMBER_REGEXP = /^-?[0-9]+(\.[0-9]+)?$/;
const HEX_REGEXP = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const COLOR_REGEXP =
  /^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i;
const validateArgs = (key = '', value: unknown): boolean => {
  if (key === null) {
    return false;
  }

  if (key === '' || !VALIDATION_REGEXP.test(key)) {
    return false;
  }

  if (value === null || value === undefined) {
    return true;
  } // encoded as `!null` or `!undefined` // encoded as `!null` or `!undefined`

  // encoded as `!null` or `!undefined`
  if (value instanceof Date) {
    return true;
  } // encoded as modified ISO string // encoded as modified ISO string

  // encoded as modified ISO string
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'string') {
    return (
      VALIDATION_REGEXP.test(value) ||
      NUMBER_REGEXP.test(value) ||
      HEX_REGEXP.test(value) ||
      COLOR_REGEXP.test(value)
    );
  }

  if (Array.isArray(value)) {
    return value.every((v) => validateArgs(key, v));
  }

  if (isPlainObject(value)) {
    return Object.entries(value as object).every(([k, v]) => validateArgs(k, v));
  }
  return false;
};

const QUERY_OPTIONS: Partial<Options> = {
  delimiter: ';', // we're parsing a single query param
  nesting: true,
  arrayRepeat: true,
  arrayRepeatSyntax: 'bracket',
  nestingSyntax: 'js', // objects are encoded using dot notation
  valueDeserializer(str: string) {
    if (str.startsWith('!')) {
      if (str === '!undefined') {
        return undefined;
      }

      if (str === '!null') {
        return null;
      }

      if (str === '!true') {
        return true;
      }

      if (str === '!false') {
        return false;
      }

      if (str.startsWith('!date(') && str.endsWith(')')) {
        return new Date(str.replaceAll(' ', '+').slice(6, -1));
      }

      if (str.startsWith('!hex(') && str.endsWith(')')) {
        return `#${str.slice(5, -1)}`;
      }

      const color = str.slice(1).match(COLOR_REGEXP);
      if (color) {
        if (str.startsWith('!rgba') || str.startsWith('!RGBA')) {
          return `${color[1]}(${color[2]}, ${color[3]}, ${color[4]}, ${color[5]})`;
        }

        if (str.startsWith('!hsla') || str.startsWith('!HSLA')) {
          return `${color[1]}(${color[2]}, ${color[3]}%, ${color[4]}%, ${color[5]})`;
        }
        return str.startsWith('!rgb') || str.startsWith('!RGB')
          ? `${color[1]}(${color[2]}, ${color[3]}, ${color[4]})`
          : `${color[1]}(${color[2]}, ${color[3]}%, ${color[4]}%)`;
      }
    }

    if (NUMBER_REGEXP.test(str)) {
      return Number(str);
    }
    return str;
  },
};
export const parseArgsParam = (argsString: string): Args => {
  const parts = argsString.split(';').map((part) => part.replace('=', '~').replace(':', '='));
  return Object.entries(parse(parts.join(';'), QUERY_OPTIONS)).reduce((acc, [key, value]) => {
    if (validateArgs(key, value)) {
      return Object.assign(acc, { [key]: value });
    }
    once.warn(dedent`
      Omitted potentially unsafe URL args.

      More info: https://storybook.js.org/docs/writing-stories/args#setting-args-through-the-url
    `);
    return acc;
  }, {} as Args);
};
