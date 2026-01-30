import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright'

import { vitestCommonConfig } from '../../vitest.shared';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      typecheck: {
        enabled: true,
      },
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  })
);
