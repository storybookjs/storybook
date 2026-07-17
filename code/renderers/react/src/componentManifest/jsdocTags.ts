import type { Spec } from 'comment-parser';
import { parse } from 'comment-parser';

import { groupBy } from './utils.ts';

const stringifyTag = (tag: Spec) =>
  (tag.type ? `{${tag.type}} ` : '') + `${tag.name} ${tag.description}`;

export function extractJSDocInfo(jsdocComment: string) {
  const lines = jsdocComment.split('\n');
  const jsDoc = ['/**', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');

  // `comment-parser` applies one `spacing` mode to the whole block, so we parse twice on purpose.
  // `preserve` keeps blank lines and line breaks in the block description so multi-paragraph
  // component comments still render as Markdown (matching react-docgen's legacy `__docgenInfo`).
  // `compact` collapses each tag value onto a single line, which is the shape tag consumers and
  // snapshots already expect — using `preserve` for both would change multi-line tag values too.
  const preserved = parse(jsDoc, { spacing: 'preserve' })[0];
  const parsed = parse(jsDoc, { spacing: 'compact' });

  // Tag values containing fenced code blocks (e.g. `@example`) must keep their line breaks:
  // collapsing puts the fences on one line, so the Markdown never renders a code block and a
  // fence's language tag (```tsx) leaks into the text.
  const stringifyPreservingFences = (tag: Spec, index: number) => {
    const compacted = stringifyTag(tag);
    return compacted.includes('```') ? stringifyTag(preserved.tags[index]).trim() : compacted;
  };

  return {
    description: preserved.description,
    tags: Object.fromEntries(
      Object.entries(
        groupBy(
          parsed[0].tags.map((tag, index) => ({
            tag: tag.tag,
            value: stringifyPreservingFences(tag, index),
          })),
          (it) => it.tag
        )
      ).map(([key, tags]) => [key, tags?.map((it) => it.value) ?? []])
    ),
  };
}
