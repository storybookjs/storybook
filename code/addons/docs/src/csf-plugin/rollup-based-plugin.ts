import { readFile } from 'node:fs/promises';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';
import { enrichCsf, formatCsf, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { RollupPlugin } from 'unplugin';

import { STORIES_REGEX } from './constants.ts';

type TransformPluginContext = {
  getCombinedSourcemap: () => any;
};

export async function transformCsf(
  this: TransformPluginContext,
  code: string,
  id: string,
  options: EnrichCsfOptions
) {
  if (!STORIES_REGEX.test(id)) {
    return;
  }

  const sourceCode = await readFile(id, 'utf-8');
  try {
    const makeTitle = (userTitle: string) => userTitle || 'default';
    const csf = loadCsf(code, { makeTitle }).parse();
    const csfSource = loadCsf(sourceCode, { makeTitle }).parse();
    await enrichCsf(csf, csfSource, options);
    const inputSourceMap = this.getCombinedSourcemap();
    return formatCsf(csf, { sourceMaps: true, inputSourceMap }, code);
  } catch (err: unknown) {
    // This can be called on legacy storiesOf files, so ignore CSF parse errors.
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith('CSF:')) {
      logger.warn(message);
    }
    return code;
  }
}

export function rollupBasedPlugin(options: EnrichCsfOptions): Partial<RollupPlugin<any>> {
  return {
    name: 'plugin-csf',
    async transform(code, id) {
      return transformCsf.call(this, code, id, options);
    },
  };
}
