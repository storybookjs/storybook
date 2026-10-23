import { describe, expect, it } from 'vitest';

import { toBaseUrl } from './base-url.ts';

describe('toBaseUrl', () => {
  it.each([
    { basePath: '/', expected: 'http://localhost:6006' },
    { basePath: '/__storybook/', expected: 'http://localhost:6006/__storybook' },
    { basePath: '/design/storybook/', expected: 'http://localhost:6006/design/storybook' },
  ])('joins $basePath onto the origin', ({ basePath, expected }) => {
    expect(toBaseUrl('http://localhost:6006', basePath)).toBe(expected);
  });
});
