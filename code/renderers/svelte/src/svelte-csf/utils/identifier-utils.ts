import { sanitize } from 'storybook/internal/csf';

export const storyIdToExportName = (storyId: string) =>
  storyId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

export const exportNameToStoryId = (exportName: string) =>
  exportName.replace(/([a-z0–9])([A-Z])/g, '$1-$2').toLowerCase();

export const storyNameToId = (name: string) =>
  // add a space before all caps and use utility from @storybook/csf to sanitize the resulting string
  sanitize(name.replace(/([A-Z])/g, ' $1').trim());

export const storyNameToExportName = (name: string) => storyIdToExportName(storyNameToId(name));

// Same check as the `is-var-name` package, so reserved words such as `default` are invalid.
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
