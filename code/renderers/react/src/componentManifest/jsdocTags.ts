import { parse } from 'comment-parser';

import { groupBy } from './utils';

export function extractJSDocTags(jsdocComment: string) {
  const lines = jsdocComment.split('\n');
  const jsDoc = ['/**', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');

  const parsed = parse(jsDoc);

  return Object.fromEntries(
    Object.entries(groupBy(parsed[0].tags, (it) => it.tag)).map(([key, tags]) => [
      key,
      tags?.map((tag) => (tag.type ? `{${tag.type}} ` : '') + `${tag.name} ${tag.description}`) ??
        [],
    ])
  );
}

export function removeTags(jsdocComment: string) {
  return jsdocComment
    .split('\n')
    .filter((line) => !line.trim().startsWith('@'))
    .join('\n');
}
