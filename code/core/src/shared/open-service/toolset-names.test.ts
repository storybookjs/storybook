import { describe, expect, it } from 'vitest';

import {
  getToolName,
  parseToolsetMethodId,
  toCliMethodName,
  toMcpToolName,
} from './toolset-names.ts';

describe('toolset method names', () => {
  it.each([
    ['findByComponent', 'find-by-component'],
    ['getHTTPFrame', 'get-http-frame'],
    ['preview', 'preview'],
  ])('converts %s to CLI kebab case', (method, expected) => {
    expect(toCliMethodName(method)).toBe(expected);
  });

  it('derives MCP names from the toolset and method', () => {
    expect(toMcpToolName('stories.preview')).toBe('stories-preview');
    expect(toMcpToolName('review.create')).toBe('review-create');
    expect(toMcpToolName('docs.showStory')).toBe('docs-show-story');
    expect(toMcpToolName('test.run')).toBe('test-run');
  });

  it('renders references in the active transport vocabulary', () => {
    expect(getToolName({ transport: 'mcp' })('docs.showStory')).toBe('docs-show-story');
    expect(getToolName({ transport: 'cli' })('docs.showStory')).toBe(
      'npx storybook tools docs show-story'
    );
    expect(getToolName({ transport: 'sdk' })('docs.showStory')).toBe('docs.showStory');
  });

  it('rejects malformed method ids instead of truncating', () => {
    expect(() => parseToolsetMethodId('foo.bar.baz')).toThrow(/Invalid toolset method id/);
    expect(() => parseToolsetMethodId('foo')).toThrow(/Invalid toolset method id/);
    expect(() => parseToolsetMethodId('.bar')).toThrow(/Invalid toolset method id/);
    expect(() => parseToolsetMethodId('foo.')).toThrow(/Invalid toolset method id/);
    expect(() => toMcpToolName('foo.bar.baz' as 'foo.bar')).toThrow(/Invalid toolset method id/);
  });

  it('documents that kebabCase can collapse distinct method keys', () => {
    // Registration must detect this collision — see toolset-registry tests.
    expect(toCliMethodName('getHTTPFrame')).toBe(toCliMethodName('getHttpFrame'));
    expect(toMcpToolName('fooBar.baz')).toBe(toMcpToolName('foo.barBaz'));
  });
});
