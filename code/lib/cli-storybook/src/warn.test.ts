import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { warn } from './warn';

vi.mock('storybook/internal/node-logger');

const mocks = vi.hoisted(() => {
  return {
    glob: vi.fn(),
  };
});

vi.mock('tinyglobby', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('tinyglobby')>()),
    glob: mocks.glob,
  };
});

describe('warn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when TypeScript is installed as a dependency', () => {
    it('should not warn', () => {
      warn({
        hasTSDependency: true,
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('when TypeScript is not installed as a dependency', () => {
    it('should not warn if `.tsx?` files are not found', async () => {
      mocks.glob.mockResolvedValue([]);
      await warn({
        hasTSDependency: false,
      });
      expect(logger.warn).toHaveBeenCalledTimes(0);
    });

    it('should warn if `.tsx?` files are found', async () => {
      mocks.glob.mockResolvedValue(['a.ts']);
      await warn({
        hasTSDependency: false,
      });
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });
});
