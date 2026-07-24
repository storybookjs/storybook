import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    plugins: [
      {
        name: 'md-loader',
        transform(code: string, id: string) {
          if (id.endsWith('.md')) {
            return { code: `export default ${JSON.stringify(code)};`, map: null };
          }
        },
      },
      {
        name: 'html-loader',
        transform(code: string, id: string) {
          if (id.endsWith('.html')) {
            return { code: `export default ${JSON.stringify(code)};`, map: null };
          }
        },
      },
    ],
  })
);
