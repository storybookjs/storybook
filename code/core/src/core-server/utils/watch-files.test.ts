import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { watchFiles } from './watch-files.ts';

vi.mock('storybook/internal/node-logger');

describe('watchFiles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('warns instead of throwing when chokidar rejects CHOKIDAR_INTERVAL', async () => {
    vi.stubEnv('CHOKIDAR_INTERVAL', '');

    const close = watchFiles([join(__dirname, '__mockdata__')], vi.fn());
    await close();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('CHOKIDAR_INTERVAL'));
  });
});
