export const isObject = (val: unknown): val is Record<string, any> =>
  val != null && typeof val === 'object' && Array.isArray(val) === false;
export const isFunction = (val: unknown): val is CallableFunction => typeof val === 'function';
