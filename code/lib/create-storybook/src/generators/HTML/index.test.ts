import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import htmlGenerator from './index.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('HTML generator', () => {
  const packageManager = {
    getDependencyVersion: vi.fn<(name: string) => string | null>(),
  };

  beforeEach(() => {
    vi.mocked(logger.log).mockImplementation(() => {});
  });

  describe('when the project uses Remix 3', () => {
    beforeEach(() => {
      packageManager.getDependencyVersion.mockImplementation((name) =>
        name === 'remix' ? '^3.0.0' : null
      );
    });

    it('notes that Remix 3 uses the HTML renderer', () => {
      htmlGenerator.postConfigure?.({ packageManager } as any);

      expect(logger.log).toHaveBeenCalledWith('Remix 3 is set up with the HTML renderer.');
    });
  });

  describe('when the project does not use Remix 3', () => {
    beforeEach(() => {
      packageManager.getDependencyVersion.mockReturnValue(null);
    });

    it('stays quiet', () => {
      htmlGenerator.postConfigure?.({ packageManager } as any);

      expect(logger.log).not.toHaveBeenCalled();
    });
  });
});
