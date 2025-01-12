import type { Args } from 'storybook/internal/types';

import type { FunctionalComponent } from 'vue';

/**
 * Omit event args
 *
 * @param args
 */
const omitEvent = (args: Args): Args =>
  args
    ? Object.fromEntries(Object.entries(args).filter(([key, value]) => !key.startsWith('on')))
    : {};

const displayObject = (obj: any): string | boolean | number => {
  if (obj && typeof obj === 'object') {
    return `{${Object.keys(obj)
      .map((key) => `${key}:${displayObject(obj[key])}`)
      .join(',')}}`;
  }

  if (typeof obj === 'string') {
    return `'${obj}'`;
  }
  return obj?.toString();
};
const htmlEventAttributeToVueEventAttribute = (key: string) => {
  return /^on[A-Za-z]/.test(key) ? key.replace(/^on/, 'v-on:').toLowerCase() : key;
};

const directiveSource = (key: string, value: unknown) =>
  key.toLowerCase().startsWith('on')
    ? `${htmlEventAttributeToVueEventAttribute(key)}='()=>({})'`
    : `${key}="${value || ''}"`;

const attributeSource = (key: string, value: unknown, dynamic?: boolean) =>
  // convert html event key to vue event key
  ['boolean', 'number', 'object'].includes(typeof value) || // dynamic value
  (dynamic && ['style', 'class'].includes(key)) // dynamic style or class
    ? `:${key}="${displayObject(value)}"`
    : directiveSource(key, value);

const evalExp = (argExpValue: any, args: Args): any => {
  let evalVal = argExpValue;

  if (evalVal && /v-bind="(\w+)"/.test(evalVal)) {
    return evalVal.replace(/"(\w+)"/g, `"${displayObject(args)}"`);
  }

  Object.keys(args).forEach((akey) => {
    const regexMatch = new RegExp(`(\\w+)\\.${akey}`, 'g');
    const regexTarget = new RegExp(`(\\w+)\\.${akey}`, 'g');
    if (regexMatch.test(evalVal)) {
      evalVal = evalVal.replace(regexTarget, displayObject(args[akey]));
    }
  });

  return evalVal;
};

const replaceValueWithRef = (source: string, args: Args, ref: string) => {
  const value = ref ? args[ref] : 'args';

  const bindValue = () => {
    const argsRef = Object.fromEntries(Object.entries(args).map(([key]) => [key, key]));
    return (displayObject(argsRef) as string).replace(/'/g, '');
  };

  const regexMatch = new RegExp(`="${value}"`, 'g');
  return source.replace(regexMatch, `="${ref ?? bindValue()}"`);
};

/**
 * Replace function curly brackets and return with empty string ex: () => { return `${text} ,
 * ${year}` } => `${text} , ${year}`
 *
 * @param slot
 * @returns
 */

function generateExpression(slot: FunctionalComponent): string {
  let body = slot.toString().split('=>')[1].trim().replace('return', '').trim();
  if (body.startsWith('{') && body.endsWith('}')) {
    body = body.substring(1, body.length - 1).trim();
  }
  return `{{${body}}}`;
}

export {
  omitEvent,
  displayObject,
  htmlEventAttributeToVueEventAttribute,
  directiveSource,
  attributeSource,
  evalExp,
  replaceValueWithRef,
  generateExpression,
};
