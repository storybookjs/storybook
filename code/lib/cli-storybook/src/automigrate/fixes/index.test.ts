import { describe, expect, it } from 'vitest';

import { allFixes } from './index.ts';

describe('allFixes', () => {
  it('wraps existing config values before adding addon-mcp', () => {
    expect(
      allFixes
        .filter((fix) => fix.id === 'wrap-getAbsolutePath' || fix.id === 'addon-mcp')
        .map((fix) => fix.id)
    ).toMatchInlineSnapshot(`
      [
        "wrap-getAbsolutePath",
        "addon-mcp",
      ]
    `);
  });
});
