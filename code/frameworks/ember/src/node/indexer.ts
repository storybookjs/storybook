import { readFile } from 'node:fs/promises';

import { type CsfOptions, loadCsf } from 'storybook/internal/csf-tools';
import type { IndexInput, Indexer, IndexerOptions } from 'storybook/internal/types';

import { Preprocessor } from 'content-tag';

export const readCsf = async (fileName: string, options: CsfOptions) => {
  const code = (await readFile(fileName, 'utf-8')).toString();
  const result = parse(fileName, code);
  return loadCsf(result.code, { ...options, fileName });
};

function parse(fileName: string, code: string) {
  const preprocessor = new Preprocessor();
  return preprocessor.process(code, { filename: fileName });
}

export const emberIndexer: Indexer = {
  test: /\.stories\.g[tj]s$/,
  createIndex: async (fileName: string, options: IndexerOptions): Promise<IndexInput[]> => {
    const csf = await readCsf(fileName, options);
    return csf.parse().indexInputs;
  },
};
