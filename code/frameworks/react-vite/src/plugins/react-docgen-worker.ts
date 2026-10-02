import { parentPort } from 'node:worker_threads';

import type { Importer } from 'react-docgen';

import type { ReactDocgenWorkerRequest, ReactDocgenWorkerResponse } from './react-docgen-pool.ts';
import {
  getMatchPath,
  getReactDocgenImporter,
  transformWithReactDocgen,
} from './react-docgen-transform.ts';

// A worker only serves one production build, whose sources do not change, so each tsconfig keeps
// one importer and react-docgen parses every imported module once.
const importers = new Map<string | undefined, Importer>();

parentPort!.on('message', ({ taskId, src, id, tsconfigPaths }: ReactDocgenWorkerRequest) => {
  try {
    const key = tsconfigPaths?.configPath;
    let importer = importers.get(key);
    if (!importer) {
      importer = getReactDocgenImporter(getMatchPath(tsconfigPaths));
      importers.set(key, importer);
    }
    const result = transformWithReactDocgen(src, id, tsconfigPaths, importer);
    parentPort!.postMessage({ taskId, result } satisfies ReactDocgenWorkerResponse);
  } catch (error) {
    const { name, message, stack } =
      error instanceof Error ? error : { name: 'Error', message: String(error), stack: undefined };
    try {
      // Keeps properties such as Babel's `code` and `loc` for the build's error report.
      parentPort!.postMessage({
        taskId,
        error: { ...(error instanceof Error ? error : {}), name, message, stack },
      } satisfies ReactDocgenWorkerResponse);
    } catch {
      parentPort!.postMessage({
        taskId,
        error: { name, message, stack },
      } satisfies ReactDocgenWorkerResponse);
    }
  }
});
