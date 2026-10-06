import { readFile } from 'node:fs/promises';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';
import { enrichCsf, formatCsf, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

interface LoaderContext {
  async: () => (err: Error | null, result?: string, map?: any) => void;
  getOptions: () => EnrichCsfOptions;
  resourcePath: string;
}

async function loader(this: LoaderContext, content: string, map: any) {
  const callback = this.async();
  const options = this.getOptions();
  const id = this.resourcePath;

  try {
    // The file can be gone by now, e.g. when it is deleted while a rebuild is running
    const sourceCode = await readFile(id, 'utf-8');
    const makeTitle = (userTitle: string) => userTitle || 'default';
    const csf = loadCsf(content, { makeTitle, fileName: id }).parse();
    const csfSource = loadCsf(sourceCode, { makeTitle }).parse();
    await enrichCsf(csf, csfSource, options);
    const formattedCsf = formatCsf(csf, { sourceMaps: true });

    if (typeof formattedCsf === 'string') {
      return callback(null, formattedCsf, map);
    }

    callback(null, formattedCsf.code, formattedCsf.map);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith('CSF:')) {
      logger.warn(message);
    }
    callback(null, content, map);
  }
}

export default loader;
