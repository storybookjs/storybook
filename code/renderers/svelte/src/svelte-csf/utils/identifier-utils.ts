import { sanitize } from 'storybook/internal/csf';

/**
 * @example storyIdToExportName('some-story') => 'SomeStory'
 */
export const storyIdToExportName = (storyId: string) =>
  storyId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * @example exportNameToStoryId('SomeStory') => 'some-story'
 */
export const exportNameToStoryId = (exportName: string) =>
  exportName.replace(/([a-z0–9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * @example storyNameToId('Some Long Story Name!') => 'some-long-story-name'
 */
export const storyNameToId = (name: string) =>
  // add a space before all caps and use utility from storybook/internal/csf to sanitize the resulting string
  sanitize(name.replace(/([A-Z])/g, ' $1').trim());

/**
 * @example storyNameToExportName('Some Long Story Name!') => 'SomeLongStoryName'
 */
export const storyNameToExportName = (name: string) => storyIdToExportName(storyNameToId(name));

/**
 * Check if a string is a valid JavaScript variable name
 * @example isValidVariableName('SomeStory') => true
 * @example isValidVariableName('Some_Story') => true
 * @example isValidVariableName('Some Story') => false
 * @example isValidVariableName('Some-Story') => false
 * @example isValidVariableName('default') => false
 *
 * @see https://github.com/shinnn/is-var-name
 */
export const isValidVariableName = (str: string) => {
  if (typeof str !== 'string') {
    return false;
  }

  if (str.trim() !== str) {
    return false;
  }

  try {
    new Function(str, 'var ' + str);
  } catch (_) {
    return false;
  }

  return true;
};

/**
 * Function to convert a non valid string template name to a valid identifier preventing
 * clashing with other templates with similar names.
 *
 * Stolen with 🧡 from the svelte codebase by @paoloricciuti
 *
 * @param str the template name
 * @returns a hash based on the content of the initial string which is a valid identifier
 */
export function hashTemplateName(str: string) {
  if (isValidVariableName(str)) return str;

  str = str.replace(/\r/g, '');
  let hash = 5381;
  let i = str.length;

  while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
  return `template_${(hash >>> 0).toString(36)}`;
}
