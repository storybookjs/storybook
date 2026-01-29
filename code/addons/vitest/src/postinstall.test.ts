import { describe, expect, it } from 'vitest';

import { isConfigAlreadySetup } from './postinstall';

const setupPath = '/project/.storybook/vitest.setup.ts';

describe('postinstall helpers', () => {
  it('detects a fully configured Vitest config with addon plugin', () => {
    const config = `
      import { defineConfig } from 'vitest/config';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
              plugins: [storybookTest({ configDir: '.storybook' })],
              test: {
                setupFiles: ['./.storybook/vitest.setup.ts'],
              },
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config, setupPath)).toBe(true);
  });

  it('returns false when storybookTest plugin is not used', () => {
    const config = `
      import { defineConfig } from 'vitest/config';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
              test: {
                setupFiles: ['./.storybook/vitest.setup.ts'],
              },
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config, setupPath)).toBe(false);
  });
});
