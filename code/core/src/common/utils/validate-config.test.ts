import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveModulePath } from 'exsolve';

import { validateFrameworkName } from './validate-config';

// mock exsolve to spy
vi.mock('exsolve', { spy: true });

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
    vi.mocked(resolveModulePath).mockImplementation(() => {});

    expect(() => validateFrameworkName('some-community-framework')).not.toThrow();
  });

  it('should not throw if scoped framework is unknown (community) but can be resolved', () => {
    vi.mocked(resolveModulePath).mockImplementation(() => {});

    expect(() => validateFrameworkName('@some-community/framework')).not.toThrow();
  });

  it('should throw if framework is unknown and cannot be resolved', () => {
    vi.mocked(resolveModulePath).mockImplementation(() => {
      throw new Error('cannot resolve');
    });

    expect(() => validateFrameworkName('foo')).toThrow();
  });
});
