/**
 * Adds `control` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes. The optional `controlsId` disambiguates multiple `<Controls>` blocks
 * rendered for the same story on a single page.
 *
 * @example
 *
 * ```ts
 * getControlId('my prop name') -> 'control-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlId = (value: string, storyId?: string, controlsId?: string) => {
  const base = value.replace(/\s+/g, '-');
  const parts = ['control'];
  if (controlsId) {
    parts.push(controlsId);
  }
  if (storyId) {
    parts.push(storyId);
  }
  parts.push(base);
  return parts.join('-');
};

/**
 * Adds `set` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes. The optional `controlsId` disambiguates multiple `<Controls>` blocks
 * rendered for the same story on a single page.
 *
 * @example
 *
 * ```ts
 * getControlSetterButtonId('my prop name') -> 'set-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlSetterButtonId = (value: string, storyId?: string, controlsId?: string) => {
  const base = value.replace(/\s+/g, '-');
  const parts = ['set'];
  if (controlsId) {
    parts.push(controlsId);
  }
  if (storyId) {
    parts.push(storyId);
  }
  parts.push(base);
  return parts.join('-');
};

/**
 * `JSON.stringify` that won't throw on values an object control can receive but that aren't plain
 * serializable data — most importantly circular structures (e.g. Vue VNodes, whose `el` references
 * back via `__vnode`), but also `BigInt`s. A single such arg must not crash the whole controls
 * panel, so circular references are rendered as `'[Circular]'` for a best-effort view.
 *
 * Plain values take the fast path and stringify identically to `JSON.stringify`, preserving shared
 * (non-circular) references; only already-unserializable values fall back to the lossy replacer.
 */
export const safeStringify = (value: unknown, space?: string | number): string => {
  try {
    return JSON.stringify(value, null, space);
  } catch {
    const seen = new WeakSet<object>();
    try {
      return JSON.stringify(
        value,
        (_key, val) => {
          if (typeof val === 'bigint') {
            return `${val}n`;
          }
          if (val !== null && typeof val === 'object') {
            if (seen.has(val)) {
              return '[Circular]';
            }
            seen.add(val);
          }
          return val;
        },
        space
      );
    } catch {
      return '';
    }
  }
};

/**
 * Whether a value round-trips through plain JSON. Object controls let users edit the value as JSON,
 * which is meaningless (and previously crash-prone) for non-serializable values — most notably Vue
 * VNodes, whose `el → __vnode → el` cycle makes `JSON.stringify` throw. Such values are shown
 * read-only instead of as an editable control.
 */
export const isJsonSerializable = (value: unknown): boolean => {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};
