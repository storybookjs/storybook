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
