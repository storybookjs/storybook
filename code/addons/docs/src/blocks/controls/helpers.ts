/**
 * Adds `control` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes. Optionally accepts a prefix to ensure uniqueness when multiple
 * Controls blocks are rendered on the same page.
 *
 * @example
 *
 * ```ts
 * getControlId('my prop name') -> 'control-my-prop-name'
 * getControlId('my prop name', 'story-1') -> 'control-story-1-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlId = (value: string, idPrefix?: string) => {
  const sanitizedValue = value.replace(/\s+/g, '-');
  return idPrefix ? `control-${idPrefix}-${sanitizedValue}` : `control-${sanitizedValue}`;
};

/**
 * Adds `set` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes. Optionally accepts a prefix to ensure uniqueness when multiple
 * Controls blocks are rendered on the same page.
 *
 * @example
 *
 * ```ts
 * getControlSetterButtonId('my prop name') -> 'set-my-prop-name'
 * getControlSetterButtonId('my prop name', 'story-1') -> 'set-story-1-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlSetterButtonId = (value: string, idPrefix?: string) => {
  const sanitizedValue = value.replace(/\s+/g, '-');
  return idPrefix ? `set-${idPrefix}-${sanitizedValue}` : `set-${sanitizedValue}`;
};
