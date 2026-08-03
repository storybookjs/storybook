// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

vi.mock('storybook/preview-api', () => ({
  useEffect: (cb: () => void) => {
    cb();
  },
  useMemo: (cb: () => unknown) => cb(),
}));

import { withOutline } from './withOutline.ts';

const OUTLINE_STYLE_ID = 'addon-outline';

const runDecorator = (context: Partial<StoryContext>) =>
  withOutline(() => 'story', {
    viewMode: 'story',
    id: 'test--story',
    ...context,
  } as StoryContext);

describe('withOutline', () => {
  beforeEach(() => {
    document.getElementById(OUTLINE_STYLE_ID)?.remove();
  });
  afterEach(() => {
    document.getElementById(OUTLINE_STYLE_ID)?.remove();
  });

  it('applies outline styles when the outline global is enabled', () => {
    runDecorator({ globals: { outline: true }, parameters: {} });
    expect(document.getElementById(OUTLINE_STYLE_ID)).not.toBeNull();
  });

  it('does not apply outline styles when disabled via parameters, even if the global is on', () => {
    runDecorator({
      globals: { outline: true },
      parameters: { outline: { disable: true } },
    });
    expect(document.getElementById(OUTLINE_STYLE_ID)).toBeNull();
  });
});
