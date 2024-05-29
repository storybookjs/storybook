import { it, expect } from 'vitest';
import {
  storyIdToExportName,
  exportNameToStoryId,
  storyNameToId,
  storyNameToExportName,
} from './identifiers';

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
