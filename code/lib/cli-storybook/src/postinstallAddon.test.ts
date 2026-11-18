import { describe, expect, it, vi } from 'vitest';

import { postinstallAddon } from './postinstallAddon.ts';

describe('postinstallAddon', () => {
  it('skips an installed addon without a postinstall hook quietly', async () => {
    const logger = { warn: vi.fn() };

    await postinstallAddon('@storybook/addon-docs', { logger } as never);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when the addon cannot be resolved', async () => {
    const logger = { warn: vi.fn() };

    await postinstallAddon('@storybook/addon-that-does-not-exist', { logger } as never);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not resolve the postinstall hook')
    );
  });
});
