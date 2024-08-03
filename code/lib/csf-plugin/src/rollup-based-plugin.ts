import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';
import { enrichCsf, formatCsf, loadCsf } from 'storybook/internal/csf-tools';
import type { RollupPlugin } from 'unplugin';
import fs from 'fs/promises';
import { STORIES_REGEX } from './constants';

const logger = console;

export function rollupBasedPlugin(options: EnrichCsfOptions): Partial<RollupPlugin<any>> {
  return {
    name: 'plugin-csf',
    async transform(code, id) {
      if (!STORIES_REGEX.test(id)) {
        return;
      }

      const sourceCode = await fs.readFile(id, 'utf-8');
      try {
        const makeTitle = (userTitle: string) => userTitle || 'default';
        const csf = loadCsf(code, { makeTitle }).parse();
        const csfSource = loadCsf(sourceCode, {
          makeTitle,
        }).parse();
        enrichCsf(csf, csfSource, options);
        const inputSourceMap = this.getCombinedSourcemap();
        return formatCsf(csf, { sourceMaps: true, inputSourceMap }, code);
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
}
