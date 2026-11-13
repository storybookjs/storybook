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
  // The banner reads import.meta.url at load time, which breaks Cloudflare Workers (#37397).
  cjsCompatBanner: false,
};

export default config;
