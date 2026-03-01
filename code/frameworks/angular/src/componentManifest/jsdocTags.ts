import { parse } from 'comment-parser';

import { groupBy } from './utils';

/**
 * Extract JSDoc information from a comment string.
 *
 * This is a generic JSDoc parser – identical logic to the one used
 * in the React componentManifest implementation.
 */
export function extractJSDocInfo(jsdocComment: string): {
  description: string;
  tags: Record<string, string[]>;
} {
  const lines = jsdocComment.split('\n');
  const jsDoc = ['/**', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');

  const parsed = parse(jsDoc);

  return {
    description: parsed[0].description,
    tags: Object.fromEntries(
      Object.entries(groupBy(parsed[0].tags, (it) => it.tag)).map(([key, tags]) => [
        key,
        tags?.map(
          (tag) => (tag.type ? `{${tag.type}} ` : '') + `${tag.name} ${tag.description}`
        ) ?? [],
      ])
    ),
  };
}
