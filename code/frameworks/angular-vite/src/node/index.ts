import type { StorybookConfig } from '../types.ts';

export function defineMain(config: StorybookConfig) {
  return config;
}

export type { StorybookConfig };
export type { AngularComponentManifest } from '../componentManifest/index.ts';
