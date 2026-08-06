import { readFileSync, statSync } from 'node:fs';

import type { CompodocJson } from '@storybook/angular-compodoc';

/**
 * Reads `documentation.json`, memoized on mtime and size: a burst of one request per component
 * would otherwise reparse a multi-megabyte file, while keying on the file's identity still picks up
 * a Compodoc run started mid-session.
 */
export const createDocumentationJsonReader = () => {
  let cached: { key: string; json: CompodocJson } | undefined;

  return (path: string): CompodocJson => {
    const stats = statSync(path);
    const key = `${path}:${stats.mtimeMs}:${stats.size}`;
    if (cached?.key !== key) {
      cached = { key, json: JSON.parse(readFileSync(path, 'utf8')) as CompodocJson };
    }
    return cached.json;
  };
};
