import { parse } from 'comment-parser';

import { groupBy } from './utils.ts';

export function extractJSDocInfo(jsdocComment: string) {
  const lines = jsdocComment.split('\n');
  const jsDoc = ['/**', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');

  // `comment-parser` applies one `spacing` mode to the whole block, so we parse twice on purpose.
  // `preserve` keeps blank lines and line breaks in the block description so multi-paragraph
  // component comments still render as Markdown (matching react-docgen's legacy `__docgenInfo`).
  // `compact` collapses each tag value onto a single line, which is the shape tag consumers and
  // snapshots already expect — using `preserve` for both would change multi-line tag values too.
  const description = parse(jsDoc, { spacing: 'preserve' })[0].description;
  const parsed = parse(jsDoc, { spacing: 'compact' });

  return {
    description,
    tags: Object.fromEntries(
      Object.entries(groupBy(parsed[0].tags, (it) => it.tag)).map(([key, tags]) => [
        key,
        tags?.map((tag) => (tag.type ? `{${tag.type}} ` : '') + `${tag.name} ${tag.description}`) ??
          [],
      ])
    ),
  };
}
