import { readCsf } from 'storybook/internal/csf-tools';
import type { Indexer } from 'storybook/internal/types';

export const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) => (await readCsf(fileName, options)).parse().indexInputs,
};
