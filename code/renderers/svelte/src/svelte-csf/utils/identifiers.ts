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

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it('storyIdToExportName', () => {
    expect(storyIdToExportName('single')).toBe('Single');
    expect(storyIdToExportName('multiple-parts')).toBe('MultipleParts');
  });
  it('exportNameToStoryId', () => {
    expect(exportNameToStoryId('Single')).toBe('single');
    expect(exportNameToStoryId('MultipleParts')).toBe('multiple-parts');
  });
  it('storyNameToId', () => {
    expect(storyNameToId('simple')).toBe('simple');
    expect(storyNameToId('PascalCase')).toBe('pascal-case');
    expect(storyNameToId('Start Case')).toBe('start-case');
    expect(storyNameToId('With 2 illegal !! characters, a PascalCase and an ?')).toBe(
      'with-2-illegal-characters-a-pascal-case-and-an'
    );
  });
  it('storyNameToExportName', () => {
    expect(storyNameToExportName('simple')).toBe('Simple');
    expect(storyNameToExportName('PascalCase')).toBe('PascalCase');
    expect(storyNameToExportName('Start Case')).toBe('StartCase');
    expect(storyNameToExportName('With 2 illegal !! characters, a PascalCase and an ?')).toBe(
      'With2IllegalCharactersAPascalCaseAndAn'
    );
  });
}
