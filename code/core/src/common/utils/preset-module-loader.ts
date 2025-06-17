import type { PresetConfig, StorybookConfig } from 'storybook/internal/types';

import { createJiti } from 'jiti';
import { resolvePath } from 'mlly';

// TODO: should the path be cwd instead?
const jitiNative = createJiti(import.meta?.url ?? __filename, { debug: true, tryNative: true });
const jitiFallback = createJiti(import.meta?.url ?? __filename, { debug: true });

export async function importPreset(presetReference: string) {
  try {
    return await jitiNative.import(presetReference, { default: true });
  } catch (error) {
    return await jitiFallback.import(presetReference, { default: true });
  }
}

export async function resolvePreset(presetReference: string) {
  return jitiNative.esmResolve(presetReference);
}

export async function resolveModule(moduleReference: string) {
  // TODO: it's actually not necessary to resolve with this before passing to importPreset, jiti does the same thing behind the scenes
  try {
    return resolvePath(moduleReference, {
      url: import.meta?.url ?? __filename,
      extensions: ['.ts', '.mts', '.cts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json'],
    });
  } catch (error) {
    return undefined;
  }
}
