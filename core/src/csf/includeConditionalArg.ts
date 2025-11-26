/* @ts-expect-error (has no typings) */
import { isEqual } from '@ngard/tiny-isequal';

import type { Args, Conditional, Globals, InputType } from './story';

const count = (vals: any[]) => vals.map((v) => typeof v !== 'undefined').filter(Boolean).length;

export const testValue = (cond: Omit<Conditional, 'arg' | 'global'>, value: any) => {
  const { exists, eq, neq, truthy } = cond as any;
  if (count([exists, eq, neq, truthy]) > 1) {
    throw new Error(`Invalid conditional test ${JSON.stringify({ exists, eq, neq })}`);
  }
  if (typeof eq !== 'undefined') {
    return isEqual(value, eq);
  }
  if (typeof neq !== 'undefined') {
    return !isEqual(value, neq);
  }
  if (typeof exists !== 'undefined') {
    const valueExists = typeof value !== 'undefined';
    return exists ? valueExists : !valueExists;
  }
  const shouldBeTruthy = typeof truthy === 'undefined' ? true : truthy;
  return shouldBeTruthy ? !!value : !value;
};

/**
 * Helper function to include/exclude an arg based on the value of other other args aka "conditional
 * args"
 */
export const includeConditionalArg = (argType: InputType, args: Args, globals: Globals) => {
  if (!argType.if) {
    return true;
  }

  const { arg, global } = argType.if as any;
  if (count([arg, global]) !== 1) {
    throw new Error(`Invalid conditional value ${JSON.stringify({ arg, global })}`);
  }

  const value = arg ? args[arg] : globals[global];

  return testValue(argType.if!, value);
};
