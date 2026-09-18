/**
 * Return a string corresponding to template filled with bindings using following pattern: For each
 * (key, value) of `bindings` replace, in template, `{{key}}` by escaped version of `value`
 *
 * @param template {String} Template with `{{binding}}`
 * @param bindings {Object} key-value object use to fill the template, `{{key}}` will be replaced by
 *   `escaped(value)`
 * @returns {String} Filled template
 */
export const interpolate = (template: string, bindings: Record<string, string>) => {
  return Object.entries(bindings).reduce((acc, [k, v]) => {
    const escapedString = v.replace(/\\/g, '/').replace(/\$/g, '$$$');
    return acc.replace(new RegExp(`{{${k}}}`, 'g'), escapedString);
  }, template);
};
