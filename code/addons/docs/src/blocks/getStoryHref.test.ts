import { describe, expect, it } from 'vitest';

import { getStoryHref } from './getStoryHref';

describe('getStoryHref', () => {
  it('builds a preview URL with the story id', () => {
    expect(getStoryHref('button--primary')).toBe('iframe.html?id=button--primary');
  });

  it('carries globals so "Open canvas in new tab" matches the active toolbar state', () => {
    // `:` is percent-encoded by URLSearchParams; the preview decodes it back before
    // `parseArgsParam`, same as the already-working `viewMode` param on docs story iframes.
    expect(getStoryHref('button--primary', { globals: 'theme:dark' })).toBe(
      'iframe.html?globals=theme%3Adark&id=button--primary'
    );
  });

  it('merges additional params alongside the id', () => {
    expect(getStoryHref('button--primary', { viewMode: 'story' })).toBe(
      'iframe.html?viewMode=story&id=button--primary'
    );
  });
});
