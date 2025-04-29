/**
 * Checks if the provided value is a plain object (i.e., {} or new Object()).
 *
 * @param val - The value to check.
 * @returns True if the value is a plain object, otherwise false.
 */
export const isObject = (val: unknown): val is Record<string, any> =>
  Object.prototype.toString.call(val) === '[object Object]';

/**
 * Checks if the provided value is a function.
 *
 * @param val - The value to check.
 * @returns True if the value is a function, otherwise false.
 */
export const isFunction = (val: unknown): val is CallableFunction => typeof val === 'function';

/**
 * Checks if the provided value is a Node.js module object.
 *
 * @param val - The value to check.
 * @returns True if the value is a Node.js module object, otherwise false.
 */
export const isModule = (val: unknown): val is NodeModule =>
  Object.prototype.toString.call(val) === '[object Module]';
