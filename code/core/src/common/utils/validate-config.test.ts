import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateFrameworkName } from './validate-config';

describe('validateFrameworkName', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });
  it('should throw if name is undefined', () => {
    expect(() => validateFrameworkName(undefined)).toThrow();
  });

  it('should throw if name is a renderer', () => {
    expect(() => validateFrameworkName('react')).toThrow();
    expect(() => validateFrameworkName('@storybook/react')).toThrow();
  });

  it('should not throw if framework is a known framework', () => {
    expect(() => validateFrameworkName('@storybook/react-vite')).not.toThrow();
  });

  it('should not throw if framework is unknown (community) but can be resolved', () => {
    // mock require.resolve to return a value
    vi.spyOn(require, 'resolve').mockReturnValue('some-community-framework');
    expect(() => validateFrameworkName('some-community-framework')).toThrow();
  });

  it('should throw if framework is unknown and cannot be resolved', () => {
    // mock require.resolve to fail
    vi.spyOn(require, 'resolve').mockImplementation(() => {
      throw new Error('Cannot resolve');
    });

    expect(() => validateFrameworkName('foo')).toThrow();
  });
});
