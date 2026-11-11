import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { AddonOptions } from './types.ts';

describe('AddonOptions', () => {
  it.each(['/custom-mcp', '/tools/mcp'])('accepts endpoint pathname %s', (endpoint) => {
    expect(v.parse(AddonOptions, { endpoint })).toEqual({
      endpoint,
      toolsets: {
        dev: true,
        docs: true,
        test: true,
      },
    });
  });

  it.each([
    'custom-mcp',
    '//custom-mcp',
    '/',
    '/custom-mcp?query=1',
    '/custom-mcp#hash',
    '/custom mcp',
    '/foo/../custom-mcp',
  ])('rejects non-pathname endpoint %s', (endpoint) => {
    expect(() => v.parse(AddonOptions, { endpoint })).toThrow(
      'Endpoint must be a literal URL pathname'
    );
  });
});
