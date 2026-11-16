import type { Plugin } from 'vite';

import { previewRuntimePath } from '../utils/preview-runtime-path.ts';
import { getResolvedVirtualModuleId } from '../virtual-file-names.ts';

const PREVIEW_RUNTIME_ENTRY = 'virtual:/@storybook/builder-vite/preview-runtime.js';

// Optimized deps read the `__STORYBOOK_MODULE_*__` globals as soon as they evaluate and never pass
// through `transform`, so the runtime has to be the first module script of the preview document.
export function injectPreviewRuntimePlugin(): Plugin {
  let base = '/';

  return {
    name: 'storybook:inject-preview-runtime-plugin',
    apply: 'serve',
    enforce: 'post',
    configResolved(config) {
      base = config.base;
    },
    load(id) {
      if (id === getResolvedVirtualModuleId(PREVIEW_RUNTIME_ENTRY)) {
        return `import { setup } from ${JSON.stringify(previewRuntimePath)};\nsetup();`;
      }
      return undefined;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (ctx.path !== '/iframe.html') {
          return undefined;
        }
        return [
          {
            tag: 'script',
            // A Vite-served entry resolves the runtime to the module URL `vite-app.js` imports.
            attrs: { type: 'module', src: `${base}@id/__x00__${PREVIEW_RUNTIME_ENTRY}` },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}
