import { describe, expect, it } from 'vitest';

import { shouldAutoplay, shouldEmbed } from './embedMode.ts';

describe('shouldEmbed', () => {
  it('requires embed=true', () => {
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story' })).toBe(false);
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story&embed=true' })).toBe(true);
    expect(shouldEmbed({ search: '?id=example--story&viewMode=story&embed=false' })).toBe(false);
  });
});

describe('shouldAutoplay', () => {
  it('disables play functions in embedded review thumbnails', () => {
    expect(shouldAutoplay({ search: '?id=example--story&viewMode=story' })).toBe(true);
    expect(
      shouldAutoplay({
        search: '?id=example--story&viewMode=story&embed=true&freeze=finished',
      })
    ).toBe(false);
  });

  it('disables play functions when the page that shows the story says autoplay=false', () => {
    expect(shouldAutoplay({ search: '?id=example--story&viewMode=story&autoplay=false' })).toBe(
      false
    );
    expect(shouldAutoplay({ search: '?id=example--story&viewMode=story&autoplay=true' })).toBe(
      true
    );
  });
});
