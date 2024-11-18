import { createRequire } from 'node:module';

import type { UserConfig } from 'vite';

export type Env = 'browser' | 'node';

export const isVitestEnv = process.env.VITEST === 'true';

export function getExecutionEnvironment(config: UserConfig) {
  return isVitestEnv && config.test?.browser?.enabled !== true ? 'node' : 'browser';
}
const requirePackage = require || createRequire(import.meta.url);

export const getEntryPoint = (subPath: string, env: Env) =>
  requirePackage.resolve(
    `@storybook/experimental-nextjs-vite/vite-plugin-mocks/${env}/mocks/${subPath}`
  );
