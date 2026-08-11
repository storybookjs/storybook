import { describe, expect, it } from 'vitest';

import { getToolName, toCliMethodName, toMcpToolName } from './toolset-names.ts';

describe('toolset method names', () => {
  it.each([
    ['findByComponent', 'find-by-component'],
    ['getHTTPFrame', 'get-http-frame'],
    ['preview', 'preview'],
  ])('converts %s to CLI kebab case', (method, expected) => {
    expect(toCliMethodName(method)).toBe(expected);
  });

  it('derives a collision-safe MCP name from the toolset and method', () => {
    expect(toMcpToolName('stories.preview')).toBe('stories-preview');
    expect(toMcpToolName('review.preview')).toBe('review-preview');
  });

  it('renders references in the active transport vocabulary', () => {
    expect(getToolName({ transport: 'mcp' })('docs.showStory')).toBe('docs-show-story');
    expect(getToolName({ transport: 'cli' })('docs.showStory')).toBe(
      'npx storybook tools docs show-story'
    );
  });
});
