import { describe, expect, it } from 'vitest';

import { storyPreviewUrl } from './review-navigation.ts';

describe('storyPreviewUrl', () => {
  it('stays interactive by default so the detail screen can be used', () => {
    const url = storyPreviewUrl('button--primary');
    expect(url).toBe('iframe.html?id=button--primary&viewMode=story');
    expect(url).not.toContain('freeze');
  });

  it('opts into the freeze contract for summary thumbnails', () => {
    const url = storyPreviewUrl('button--primary', { freeze: true });
    expect(url).toBe('iframe.html?id=button--primary&viewMode=story&freeze=finished');
  });
});
