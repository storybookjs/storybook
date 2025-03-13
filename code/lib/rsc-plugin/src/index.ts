import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';

import { rscTransform } from './rsc-transform';

export interface RscPluginOptions {}

const unpluginFactory: UnpluginFactory<RscPluginOptions | undefined> = (options) => ({
  name: 'unplugin-rsc',
  enforce: 'pre',
  transformInclude(id) {
    return /\.(tsx|jsx)$/.test(id);
  },
  transform(code) {
    return rscTransform(code);
  },
});

export const unplugin = createUnplugin(unpluginFactory);

export const { esbuild } = unplugin;
export const { webpack } = unplugin;
export const { rollup } = unplugin;
export const { vite } = unplugin;
