import { readFile } from 'node:fs/promises';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';
import { enrichCsf, formatCsf, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { RollupPlugin } from 'unplugin';

import { STORIES_REGEX } from './constants.ts';

export async function transformCsf(
  code: string,
  id: string,
  options: EnrichCsfOptions
): Promise<ReturnType<typeof formatCsf> | undefined> {
  if (!STORIES_REGEX.test(id)) {
    return;
  }

  const sourceCode = await readFile(id, 'utf-8');
  try {
    const makeTitle = (userTitle: string) => userTitle || 'default';
    const csf = loadCsf(code, { makeTitle, fileName: id }).parse();
    // Enrichment edits the source text and leaves the parsed nodes untouched, so `csf` can double as
    // the source. An `enrichCsf` hook may print the edited file, so it gets a separate parse.
    const csfSource =
      code === sourceCode && !options.enrichCsf
        ? csf
        : loadCsf(sourceCode, { makeTitle, fileName: id }).parse();
    await enrichCsf(csf, csfSource, options);
    return formatCsf(csf, { sourceMaps: true, sourceFileName: id });
  } catch (err: unknown) {
    // Any .stories file that fails to parse (legacy or broken) passes through unmodified so doc generation does not crash.
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
      return transformCsf(code, id, options);
    },
  };
}
