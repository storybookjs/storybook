import type { Spec } from 'comment-parser';
import { parse } from 'comment-parser';

/** Compact JSDoc tag map: tag name → list of tag values (e.g. `@example a` → `{ example: ['a'] }`). */
export type JsDocTagMap = Record<string, string[]>;

function groupByTag(specs: Spec[]): Map<string, Spec[]> {
  const groups = new Map<string, Spec[]>();
  for (const spec of specs) {
    const group = groups.get(spec.tag);
    if (group) {
      group.push(spec);
    } else {
      groups.set(spec.tag, [spec]);
    }
  }
  return groups;
}

/**
 * Splits a bare docblock body (no `/**` markers) into its description and a compact tag map.
 *
 * Shared by the server-side docgen providers so component descriptions and `@summary` / `@import`
 * style tags read the same across renderers.
 */
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
      Array.from(groupByTag(parsed[0].tags), ([tag, specs]) => [
        tag,
        specs.map(
          (spec) => (spec.type ? `{${spec.type}} ` : '') + `${spec.name} ${spec.description}`
        ),
      ])
    ) as JsDocTagMap,
  };
}

/**
 * Resolves the component-level description, summary, and tag map a docgen payload reports.
 *
 * The CSF `meta` docblock wins over the docgen engine's own component description, and an explicit
 * `@describe` / `@desc` tag wins over the block description.
 */
export function extractComponentDescription(
  metaJsDoc: string | undefined,
  docgenDescription: string | undefined,
  docgenJsDocTags?: JsDocTagMap
) {
  const jsdocComment = metaJsDoc || docgenDescription;
  const extracted = jsdocComment ? extractJSDocInfo(jsdocComment) : undefined;
  const tags = docgenJsDocTags ?? extracted?.tags ?? {};
  const description = extracted?.description;

  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}
