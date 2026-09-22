import { beforeEach, expect, it, vi } from 'vitest';

import { importModule } from '../shared/utils/module.ts';
import { getPresets } from './presets.ts';

vi.mock('../shared/utils/module.ts', () => ({
  importModule: vi.fn(),
  safeResolveModule: vi.fn(),
}));

const storySort = vi.fn();

beforeEach(() => {
  storySort.mockReset();
  vi.mocked(importModule).mockImplementation(async (path: string) => {
    if (path === 'preset-first') {
      return { storySort: { order: ['first'] } };
    }
    if (path === 'preset-second') {
      return { storySort };
    }
    throw new Error(`Could not resolve ${path}`);
  });
});

it('returns the last static preset value without invoking functions', async () => {
  const presets = await getPresets(['preset-first', 'preset-second'], { configDir: '.' });

  expect(presets.get?.('storySort')).toBe(storySort);
  expect(storySort).not.toHaveBeenCalled();
});
