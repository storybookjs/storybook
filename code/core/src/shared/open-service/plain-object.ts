// Own keys that must never be copied or assigned, to block prototype pollution.
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// deepsignal stores signals on `$`-prefixed keys; those must never be assigned or addressed.
export function isReservedKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key) || key.startsWith('$');
}

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clonePlain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => clonePlain(entry));
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value as object)) {
    if (isReservedKey(key)) {
      continue;
    }
    copy[key] = clonePlain((value as Record<string, unknown>)[key]);
  }
  return copy;
}
