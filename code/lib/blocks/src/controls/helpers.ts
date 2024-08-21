/**
 * Adds `control` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes
 *
 * @example
 *
 * ```ts
 * getControlId('my prop name') -> 'control-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlId = (value: string) => `control-${value.replace(/\s+/g, '-')}`;

/**
 * Adds `set` prefix to make ID attribute more specific. Removes spaces because spaces are not
 * allowed in ID attributes
 *
 * @example
 *
 * ```ts
 * getControlSetterButtonId('my prop name') -> 'set-my-prop-name'
 * ```
 *
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 */
export const getControlSetterButtonId = (value: string) => `set-${value.replace(/\s+/g, '-')}`;
