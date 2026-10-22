import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import htmlGenerator from './index.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('HTML generator', () => {
  const packageManager = {
    getDependencyVersion: vi.fn<(name: string) => string | null>(),
    getDeclaredVersionSpecifier: vi.fn<(name: string) => Promise<string | null>>(async () => null),
  };

  beforeEach(() => {
    vi.mocked(logger.log).mockImplementation(() => {});
  });

  describe('when the project uses Remix 3', () => {
    beforeEach(() => {
      vi.mocked(packageManager.getDependencyVersion).mockImplementation((name) =>
        name === 'remix' ? '^3.0.0' : null
      );
    });

    it('notes that Remix 3 uses the HTML renderer', async () => {
      await htmlGenerator.postConfigure?.({ packageManager } as any);

      expect(logger.log).toHaveBeenCalledWith('Remix 3 is set up with the HTML renderer.');
    });
  });

  describe('when remix is a catalog specifier for Remix 3', () => {
    beforeEach(() => {
      vi.mocked(packageManager.getDependencyVersion).mockReturnValue('catalog:');
      vi.mocked(packageManager.getDeclaredVersionSpecifier).mockResolvedValue('3.1.0');
    });

    it('notes that Remix 3 uses the HTML renderer', async () => {
      await htmlGenerator.postConfigure?.({ packageManager } as any);

      expect(logger.log).toHaveBeenCalledWith('Remix 3 is set up with the HTML renderer.');
    });
  });

  describe('when the project does not use Remix 3', () => {
    beforeEach(() => {
      vi.mocked(packageManager.getDependencyVersion).mockReturnValue(null);
    });

    it('stays quiet', async () => {
      await htmlGenerator.postConfigure?.({ packageManager } as any);

      expect(logger.log).not.toHaveBeenCalled();
    });
  });
});
