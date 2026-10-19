import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import htmlGenerator from './index.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('HTML generator', () => {
  beforeEach(() => {
    vi.mocked(logger.log).mockImplementation(() => {});
  });

  it('notes that Remix 3 uses the HTML renderer', () => {
    const packageManager = {
      getDependencyVersion: vi.fn((name: string) => (name === 'remix' ? '^3.0.0' : null)),
    } as any;

    htmlGenerator.postConfigure?.({ packageManager });

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('HTML renderer (@storybook/html-vite)')
    );
  });

  it('stays quiet for projects that are not Remix 3', () => {
    const packageManager = {
      getDependencyVersion: vi.fn(() => null),
    } as any;

    htmlGenerator.postConfigure?.({ packageManager });

    expect(logger.log).not.toHaveBeenCalled();
  });
});
