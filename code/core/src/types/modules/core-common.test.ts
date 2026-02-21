import { describe, expect, it } from 'vitest';

import type { StorybookConfig } from '@storybook/react-vite';

describe('TagsOptions', () => {
  describe('defaultFilterSelection', () => {
    it('accepts undefined', () => {
      const config: StorybookConfig = {
        stories: [],
        framework: '@storybook/react-vite',
        tags: {
          unit: {
            defaultFilterSelection:
              process.env['NODE_ENV'] !== 'development' ? 'exclude' : undefined,
          },
        },
      };
      expect(config).toBeDefined();
    });
  });
});
