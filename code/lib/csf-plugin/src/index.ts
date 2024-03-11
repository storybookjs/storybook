import { createUnplugin } from 'unplugin';
import fs from 'fs/promises';
import { loadCsf, enrichCsf, formatCsf } from '@storybook/csf-tools';
import type { EnrichCsfOptions } from '@storybook/csf-tools';

export type CsfPluginOptions = EnrichCsfOptions;

const STORIES_REGEX = /\.(story|stories)\.[tj]sx?$/;

const logger = console;

export const unplugin = createUnplugin<CsfPluginOptions>((options) => {
  return {
    name: 'unplugin-csf',
    transformInclude(id) {
      return STORIES_REGEX.test(id);
    },
    async transform(code, id) {
      const sourceCode = await fs.readFile(id, 'utf-8');
      try {
        const makeTitle = (userTitle: string) => userTitle || 'default';
        const csf = loadCsf(code, { makeTitle }).parse();
        const csfSource = loadCsf(sourceCode, {
          makeTitle,
        }).parse();
        enrichCsf(csf, csfSource, options);
        return formatCsf(csf, { sourceMaps: true });
      } catch (err: any) {
        // This can be called on legacy storiesOf files, so just ignore
        // those errors. But warn about other errors.
        if (!err.message?.startsWith('CSF:')) {
          logger.warn(err.message);
        }
        return code;
      }
    },
  };
});

export const { esbuild } = unplugin;
export const { webpack } = unplugin;
export const { rollup } = unplugin;
export const { vite } = unplugin;
