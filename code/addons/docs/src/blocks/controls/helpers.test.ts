import { describe, expect, it } from 'vitest';

import { getControlId, getControlSetterButtonId } from './helpers';

describe('getControlId', () => {
  it.each([
    // caseName, input, expected
    ['lower case', 'some-id', 'control-some-id'],
    ['upper case', 'SOME-ID', 'control-SOME-ID'],
    ['all valid characters', 'some_weird-:custom.id', 'control-some_weird-:custom.id'],
  ])('%s', (name, input, expected) => {
    expect(getControlId(input)).toBe(expected);
  });

  it('includes storyId when provided', () => {
    expect(getControlId('some-id', 'story--name')).toBe('control-story--name-some-id');
  });
});

describe('getControlSetterButtonId', () => {
  it.each([
    // caseName, input, expected
    ['lower case', 'some-id', 'set-some-id'],
    ['upper case', 'SOME-ID', 'set-SOME-ID'],
    ['all valid characters', 'some_weird-:custom.id', 'set-some_weird-:custom.id'],
  ])('%s', (name, input, expected) => {
    expect(getControlSetterButtonId(input)).toBe(expected);
  });

  it('includes storyId when provided', () => {
    expect(getControlSetterButtonId('some-id', 'story--name')).toBe('set-story--name-some-id');
  });
});
