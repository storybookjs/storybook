import { UnprintableArgError } from './snippetTemplate.ts';

// A JavaScript printing helper several renderers' `PrintHole` share. It is not part of the hole
// contract in `snippetTemplate.ts`: a renderer may use it or not.

/**
 * Prints an arg value as the JavaScript literal it would be written as. A value with no literal,
 * such as a function, a class instance, a cycle or anything `opaque` matches at any depth, throws
 * an {@link UnprintableArgError} for `name`.
 */
export function printValue(
  value: unknown,
  name: string,
  { quote = '"', opaque }: { quote?: '"' | "'"; opaque?: (value: unknown) => boolean } = {}
): string {
  const parents = new Set<unknown>();
  const print = (item: unknown): string => {
    if (opaque?.(item) || parents.has(item)) {
      throw new UnprintableArgError(name);
    }
    if (typeof item === 'string') {
      const escaped = item
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replaceAll(quote, `\\${quote}`);
      return `${quote}${escaped}${quote}`;
    }
    if (item === null || ['undefined', 'number', 'boolean'].includes(typeof item)) {
      return String(item);
    }
    if (!Array.isArray(item) && !isPlainObject(item)) {
      throw new UnprintableArgError(name);
    }
    parents.add(item);
    const printed = Array.isArray(item) ? printArray(item) : printObject(item);
    parents.delete(item);
    return printed;
  };
  const printArray = (array: unknown[]) =>
    `[${Array.from(array, (_, index) => (index in array ? print(array[index]) : '')).join(', ')}]`;
  const printObject = (object: Record<string, unknown>) => {
    const properties: string[] = [];
    for (const key of Object.keys(object)) {
      if (object[key] !== undefined) {
        // A `__proto__` key, quoted or not, sets the prototype; only a computed one is a property.
        const printedKey =
          key === '__proto__'
            ? `[${print(key)}]`
            : /^[A-Za-z_$][\w$]*$/.test(key)
              ? key
              : print(key);
        properties.push(`${printedKey}: ${print(object[key])}`);
      }
    }
    return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
  };
  return print(value);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
