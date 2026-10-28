import {
  EXPORT_ORDER_FILE_PATTERN,
  appendNamedExportsOrder,
} from '@storybook/core/internal/preview-page';

import type { Plugin } from 'vite';

export function injectExportOrderPlugin(): Plugin {
  return {
    name: 'storybook:inject-export-order-plugin',
    // Runs after TypeScript is transpiled.
    enforce: 'post',
    transform: {
      filter: { id: EXPORT_ORDER_FILE_PATTERN },
      async handler(code, id) {
        const result = await appendNamedExportsOrder(code, id);
        return result && { code: result.code, map: result.map.toString() };
      },
    },
  };
}
