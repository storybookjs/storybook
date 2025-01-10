import { describe, expect, it } from 'vitest';

import { defineJestParameter } from './shared';

describe('defineJestParameter', () => {
  it('infers from story file name if jest parameter is not provided', () => {
    expect(defineJestParameter({ fileName: './stories/addon-jest.stories.js' })).toEqual([
      'addon-jest',
    ]);
  });

  it('wraps string jest parameter with an array', () => {
    expect(defineJestParameter({ jest: 'addon-jest' })).toEqual(['addon-jest']);
  });

  it('returns as is if jest parameter is an array', () => {
    expect(defineJestParameter({ jest: ['addon-jest', 'something-else'] })).toEqual([
      'addon-jest',
      'something-else',
    ]);
  });

  it('returns null if disabled option is passed to jest parameter', () => {
    expect(defineJestParameter({ jest: { disabled: true } })).toBeNull();
  });

  it('returns null if no filename to infer from', () => {
    expect(defineJestParameter({})).toBeNull();
  });

  it('returns null if filename is a module ID that cannot be inferred from', () => {
    // @ts-expect-error Storybook's fileName type is string, but according to this test it could be number in case it is a module id.
    expect(defineJestParameter({ fileName: 1234 })).toBeNull();
  });
});
