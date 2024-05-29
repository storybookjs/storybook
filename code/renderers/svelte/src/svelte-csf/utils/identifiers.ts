import { sanitize } from '@storybook/csf';

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
  // add a space before all caps and use utility from @storybook/csf to sanitize the resulting
  sanitize(name.replace(/([A-Z])/g, ' $1').trim());

/**
 * @example storyNameToExportName('Some Long Story Name!') => 'SomeLongStoryName'
 */
export const storyNameToExportName = (name: string) => storyIdToExportName(storyNameToId(name));
