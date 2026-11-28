import type { BlockMarkers, Spec } from 'comment-parser';
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

function hasTags(tags: JsDocTagMap | undefined): tags is JsDocTagMap {
  return !!tags && Object.keys(tags).length > 0;
}

function mergeTags(
  docgenJsDocTags: JsDocTagMap | undefined,
  extractedTags: JsDocTagMap | undefined
): JsDocTagMap {
  if (!hasTags(docgenJsDocTags)) {
    return extractedTags ?? {};
  }
  return { ...(extractedTags ?? {}), ...docgenJsDocTags };
}

/**
 * Splits a bare docblock body (no `/**` markers) into its description and a compact tag map.
 *
 * For CSF story and meta docblocks. The docblocks on a component's declaration are read by
 * {@link extractDeclarationJSDocInfo}; the two differ on malformed input (this one only treats
 * line-leading `@tags` as tags).
 */
export function extractJSDocInfo(jsdocComment: string) {
  const lines = jsdocComment.split('\n');
  // The text does not always come from a JS comment. The HTML comment above a Svelte story is one
  // example, and a line in it can end in `*/`. comment-parser closes the block at the first line that
  // ends in its end marker, so only the closing line that we add carries it: a line of source text
  // never ends in a NUL (`\u0000`) followed by `*/`. comment-parser checks the start marker only
  // before the block opens, so the default is safe.
  const markers: BlockMarkers = { start: '/**', nostart: '/***', delim: '*', end: '\u0000*/' };
  const jsDoc = ['/**', ...lines.map((line) => ` * ${line}`), ` ${markers.end}`].join('\n');

  // `comment-parser` applies one `spacing` mode to the whole block, so we parse twice on purpose.
  // `preserve` keeps blank lines and line breaks in the block description so multi-paragraph
  // component comments still render as Markdown (matching react-docgen's legacy `__docgenInfo`).
  // `compact` collapses each tag value onto a single line, which is the shape tag consumers and
  // snapshots already expect — using `preserve` for both would change multi-line tag values too.
  const description = parse(jsDoc, { spacing: 'preserve', markers })[0].description;
  const parsed = parse(jsDoc, { spacing: 'compact', markers });

  return {
    description,
    tags: Object.fromEntries(
      Array.from(groupByTag(parsed[0].tags), ([tag, specs]) => [
        tag,
        specs.map((spec) =>
          ((spec.type ? `{${spec.type}} ` : '') + `${spec.name} ${spec.description}`).trim()
        ),
      ])
    ) as JsDocTagMap,
  };
}

// TypeScript starts a tag at an `@` that opens a line, or that sits between a space and text.
const TYPESCRIPT_TAG_START = /^[ \t]*@|[ \t]@(?!\s)/m;

/**
 * The description and tag map of a declaration, from the bare bodies of its docblocks, as an
 * editor shows them on hover. A tag can start mid-sentence, and a name declared more than once, as
 * a component with overloads or with a type of its name, has the descriptions of its docblocks on
 * a line each.
 *
 * This is how docgen reads the docs of a component. It follows TypeScript for docblocks as they
 * are usually written, and is not its parser:
 *
 * - An inline `{@link}` stays as written, where TypeScript prints it by what it resolves to.
 * - A line of a tag's text loses its indentation, where TypeScript keeps what goes beyond the
 *   tag's own.
 * - An `@` after a space starts a tag between backticks too, where TypeScript reads on in the text
 *   of a tag.
 */
export function extractDeclarationJSDocInfo(docblocks: string[]) {
  const descriptions = new Set<string>();
  const tags: JsDocTagMap = {};
  for (const docblock of docblocks) {
    const [description, ...tagTexts] = docblock.split(TYPESCRIPT_TAG_START);
    if (description.trim()) {
      descriptions.add(description.trim());
    }
    for (const tagText of tagTexts) {
      const name = /^[\w$-]*/.exec(tagText)![0];
      const value = tagText
        .slice(name.length)
        .replace(/^[ \t]+/gm, '')
        .trim();
      (tags[name] ??= []).push(value);
    }
  }
  return { description: [...descriptions].join('\n'), tags };
}

/**
 * Resolves the description, summary, and tag map a docgen payload reports.
 *
 * The CSF `meta` docblock wins over the docgen engine's own component description, and an explicit
 * `@describe` / `@desc` tag wins over the block description. Docgen/provider tags win over same
 * named docblock tags, but a provider that found no tags must not suppress the docblock's own.
 * `extractStoryJSDocInfo` reuses this for story docblocks, so both resolve tags identically.
 */
export function extractComponentDescription(
  metaJsDoc: string | undefined,
  docgenDescription: string | undefined,
  docgenJsDocTags?: JsDocTagMap
) {
  const jsdocComment = metaJsDoc || docgenDescription;
  const extracted = jsdocComment ? extractJSDocInfo(jsdocComment) : undefined;
  const tags = mergeTags(docgenJsDocTags, extracted?.tags);
  const description = extracted?.description;

  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}
