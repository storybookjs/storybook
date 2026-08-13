import { describe, expect, it } from 'vitest';

import { resolveBaseUrl } from './base-url.ts';

describe('resolveBaseUrl', () => {
  it('returns the bare origin for the default basePath', () => {
    expect(resolveBaseUrl({ origin: 'http://localhost:6006' })).toBe('http://localhost:6006');
    expect(resolveBaseUrl({ origin: 'http://localhost:6006', basePath: '/' })).toBe(
      'http://localhost:6006'
    );
  });

  it('appends the basePath without a trailing slash', () => {
    expect(resolveBaseUrl({ origin: 'http://localhost:5173', basePath: '/__storybook/' })).toBe(
      'http://localhost:5173/__storybook'
    );
    expect(
      resolveBaseUrl({ origin: 'http://localhost:5173', basePath: '/design/storybook/' })
    ).toBe('http://localhost:5173/design/storybook');
  });

  it('does not double up slashes when the origin carries one', () => {
    expect(resolveBaseUrl({ origin: 'http://localhost:5173/', basePath: '/__storybook/' })).toBe(
      'http://localhost:5173/__storybook'
    );
  });
});
