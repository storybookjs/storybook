// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/client-logger';

import { withVisionSimulator } from './withVisionSimulator.ts';

vi.mock('storybook/internal/client-logger', () => ({
  once: {
    warn: vi.fn(),
  },
}));

vi.mock('storybook/preview-api', () => ({
  useCallback: (callback: () => unknown) => callback,
  useEffect: (effect: () => unknown) => effect(),
}));

describe('withVisionSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
  });

  it('warns when globals.vision references an unavailable simulation', () => {
    withVisionSimulator(vi.fn(), {
      globals: { vision: 'protanomaly' },
    } as any);

    expect(once.warn).toHaveBeenCalledTimes(1);
    expect(once.warn).toHaveBeenCalledWith(
      expect.stringContaining('The vision simulation "protanomaly" is not available.')
    );
  });
});
