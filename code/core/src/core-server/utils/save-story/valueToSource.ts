import { type SourceEditor, printValue } from '../../../csf-tools/estree/editor.ts';

/**
 * Stands in for a function arg, which the controls panel cannot send. It prints as `() => {}`
 * whatever the bundler made of the source of a function literal.
 */
export const emptyFunction: () => void = Object.assign(() => {}, { toString: () => '() => {}' });

// Members set to `undefined` are left out, as they would not survive JSON either. Only plain
// objects are walked: a RegExp prints as itself.
const withoutUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withoutUndefined);
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)])
    );
  }
  return value;
};

/** Print an arg value as source in the editor's style, objects one member per line. */
export const valueToSource = (value: unknown, { quote, indent }: SourceEditor): string =>
  printValue(withoutUndefined(value), quote, { indent });
