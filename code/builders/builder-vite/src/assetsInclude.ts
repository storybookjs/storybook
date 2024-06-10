import type { InlineConfig as ViteInlineConfig } from 'vite';

export function getAssetsInclude(config: ViteInlineConfig, newPath: string[]): (string | RegExp)[] {
  const { assetsInclude } = config;

  if (!assetsInclude) {
    return newPath;
  }

  if (Array.isArray(assetsInclude)) {
    return [...assetsInclude, ...newPath];
  } else {
    return [assetsInclude, ...newPath];
  }
}
