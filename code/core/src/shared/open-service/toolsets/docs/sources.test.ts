import { describe, expect, it } from 'vitest';
import { getSourceMcpEndpoint } from './sources.ts';

describe('getSourceMcpEndpoint', () => {
  it.each([
    ['https://example.com', 'https://example.com/mcp'],
    ['https://example.com/storybook/', 'https://example.com/storybook/mcp'],
    ['https://example.com/storybook/?foo=bar#section', 'https://example.com/storybook/mcp'],
  ])('returns the source-specific MCP endpoint for %s', (url, expected) => {
    expect(getSourceMcpEndpoint({ id: 'remote', title: 'Remote', url })).toBe(expected);
  });
});
