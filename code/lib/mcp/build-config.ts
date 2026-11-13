import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
    ],
  },
  // Runs on Cloudflare Workers (#37397).
  cjsCompatBanner: false,
};

export default config;
