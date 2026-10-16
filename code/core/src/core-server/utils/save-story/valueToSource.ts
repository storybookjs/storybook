import { printValue } from '../../../csf-tools/estree/editor.ts';

// Members set to `undefined` are left out, as they would not survive JSON either.
const withoutUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)])
    );
  }
  return value;
};

/** Print an arg value as source, with objects expanded one member per line. */
export const valueToSource = (value: unknown, quote = '"'): string =>
  printValue(withoutUndefined(value), quote, { expanded: true });
