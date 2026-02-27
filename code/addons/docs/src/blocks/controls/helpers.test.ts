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

  it.each([
    // caseName, input, prefix, expected
    ['with prefix', 'some-id', 'story-1', 'control-story-1-some-id'],
    ['with prefix and spaces', 'my prop', 'story-2', 'control-story-2-my-prop'],
    ['with undefined prefix', 'some-id', undefined, 'control-some-id'],
  ])('%s with prefix', (name, input, prefix, expected) => {
    expect(getControlId(input, prefix)).toBe(expected);
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

  it.each([
    // caseName, input, prefix, expected
    ['with prefix', 'some-id', 'story-1', 'set-story-1-some-id'],
    ['with prefix and spaces', 'my prop', 'story-2', 'set-story-2-my-prop'],
    ['with undefined prefix', 'some-id', undefined, 'set-some-id'],
  ])('%s with prefix', (name, input, prefix, expected) => {
    expect(getControlSetterButtonId(input, prefix)).toBe(expected);
  });
});
