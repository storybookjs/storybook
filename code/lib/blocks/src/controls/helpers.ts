/**
 * Adds `control` prefix to make ID attribute more specific.
 * Removes spaces because spaces are not allowed in ID attributes
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 * @example getControlId('my prop name') -> 'control-my-prop-name'
 */
export const getControlId = (value: string) => `control-${value.replace(/\s+/g, '-')}`;

/**
 * Adds `set` prefix to make ID attribute more specific.
 * Removes spaces because spaces are not allowed in ID attributes
 * @link http://xahlee.info/js/html_allowed_chars_in_attribute.html
 * @example getControlSetterButtonId('my prop name') -> 'set-my-prop-name'
 */
export const getControlSetterButtonId = (value: string) => `set-${value.replace(/\s+/g, '-')}`;
