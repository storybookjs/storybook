import type * as tsModule from 'typescript';

import type { JsDocTag } from '../types.ts';

// `description` and `rawdescription` both carry the same plain text; nothing downstream parses it
// as HTML, unlike the Markdown-rendered comments Compodoc produced.
export function getJsDocDescription(
  ts: typeof tsModule,
  node: tsModule.Node
): { description?: string; rawdescription?: string } {
  const jsDocs = ts
    .getJSDocCommentsAndTags(node)
    .filter((doc): doc is tsModule.JSDoc => ts.isJSDoc(doc));
  const comment = jsDocs.at(-1)?.comment;
  let text = comment === undefined ? undefined : ts.getTextOfJSDocComment(comment);
  // `/*****`-style openers leak pure-asterisk lines into the comment text.
  text = text?.replace(/^(?:[ \t]*\*+[ \t]*\n)+/, '').replace(/^[ \t]*\*+[ \t]*$/, '');
  // An explicit `@description` tag wins: the text before it is usually a `property foo` header,
  // not prose.
  const descriptionTag = ts
    .getJSDocTags(node)
    .find((tag) => tag.tagName.text === 'description' && tag.comment !== undefined);
  if (descriptionTag) {
    text = ts.getTextOfJSDocComment(descriptionTag.comment);
  }
  const trimmed = text?.replace(/\s+$/, '');
  if (!trimmed) {
    return {};
  }
  return { description: trimmed, rawdescription: trimmed };
}

function getJsDocTags(ts: typeof tsModule, node: tsModule.Node): JsDocTag[] | undefined {
  const tags = ts.getJSDocTags(node);
  if (tags.length === 0) {
    return undefined;
  }
  return tags.map((tag) => {
    const name = tag.tagName.text;
    let comment = tag.comment === undefined ? undefined : ts.getTextOfJSDocComment(tag.comment);
    // TS parses `@see https://…` into a name (`https`) plus a comment (`://…`).
    if (ts.isJSDocSeeTag(tag) && tag.name) {
      comment = `${tag.name.getText()}${comment ?? ''}`;
    }
    // Consumers read `escapedText`; `text` mirrors the raw TypeScript tag-node shape.
    const tagName: { text: string; escapedText: string } = { text: name, escapedText: name };
    return { tagName, ...(comment === undefined ? {} : { comment }) };
  });
}

export function getJsDocTagsField(
  ts: typeof tsModule,
  node: tsModule.Node
): { jsdoctags?: JsDocTag[] } {
  const tags = getJsDocTags(ts, node);
  return tags ? { jsdoctags: tags } : {};
}

export function hasJsDocTag(ts: typeof tsModule, node: tsModule.Node, tagName: string): boolean {
  return ts.getJSDocTags(node).some((tag) => tag.tagName.text === tagName);
}
