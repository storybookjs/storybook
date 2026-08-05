import { readFileSync, statSync } from 'node:fs';

import type { CompodocJson } from '@storybook/angular-compodoc';

/**
 * Reads `documentation.json`, memoized on the file's mtime and size: the burst of one request per
 * component would otherwise reparse a real app's multi-megabyte file, while keying on the file's
 * identity still picks up a Compodoc run the user starts mid-session.
 *
 * Throws when the file is absent or unreadable, so callers decide what an unusable scan means for
 * them rather than inheriting a shared answer.
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
