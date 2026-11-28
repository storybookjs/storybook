import type { DocgenWorkerModule } from '../../types.ts';

export const createDocgenProvider: DocgenWorkerModule['createDocgenProvider'] =
  () =>
  () =>
  async ({ entry }) => ({ id: entry.id, name: entry.title, path: entry.importPath, jsDocTags: {} });

export const createSummaryProvider: DocgenWorkerModule['createSummaryProvider'] = () => {
  throw new Error('no summaries');
};
