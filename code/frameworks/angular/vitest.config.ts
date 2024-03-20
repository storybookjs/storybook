/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestCommonConfig } from '../../vitest.workspace';

export default defineConfig(({ mode }) => {
  return mergeConfig(vitestCommonConfig, {
    test: {
      setupFiles: ['src/test-setup.ts'],
      environment: 'jsdom',
    },
  });
});
