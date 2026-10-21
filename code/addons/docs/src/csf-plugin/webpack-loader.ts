import { readFile } from 'node:fs/promises';

import type { CsfFile, EnrichCsfOptions, FormatCsfOptions } from 'storybook/internal/csf-tools';
import { enrichCsf, formatCsf, loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

interface LoaderContext {
  async: () => (err: Error | null, result?: string, map?: any) => void;
  getOptions: () => EnrichCsfOptions;
  resourcePath: string;
}

// An incoming map that cannot be read only costs the mapping through it, as in the `sb.mock`
// rewrite: the enrichment is kept, with a map from the loaded code.
function formatWithInputMap(
  csf: CsfFile,
  inputSourceMap: FormatCsfOptions['inputSourceMap'],
  id: string
) {
  try {
    return formatCsf(csf, { sourceMaps: true, inputSourceMap });
  } catch (error) {
    logger.debug(`Could not compose the source map of ${id}: ${error}`);
    return formatCsf(csf, { sourceMaps: true });
  }
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
    const csfSource = loadCsf(sourceCode, { makeTitle, fileName: id }).parse();
    await enrichCsf(csf, csfSource, options);
    const formattedCsf = formatWithInputMap(csf, map ?? undefined, id);
    // webpack's map type requires `file`, which `formatCsf` leaves unset.
    callback(null, formattedCsf.code, { ...formattedCsf.map, file: id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith('CSF:')) {
      logger.warn(message);
    }
    callback(null, content, map);
  }
}

export default loader;
