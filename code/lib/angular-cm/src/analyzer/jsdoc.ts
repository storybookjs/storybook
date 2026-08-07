import type * as tsModule from 'typescript';

import type { JsDocTag } from '@storybook/angular-compodoc';

/**
 * Plain-text JSDoc extraction. Unlike Compodoc, which renders comments through Markdown to HTML,
 * both `description` and `rawdescription` carry the same plain comment text: the consumer prefers
 * `rawdescription` and its `unwrapHtml` passes plain text through unchanged.
 */
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
  // An explicit `@description` tag is the description (the compodoc convention); the text before
  // the tags in such comments is usually a `property foo` header, not prose.
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
    // TS parses `@see https://…` into a name (`https`) plus a comment (`://…`); rejoin them.
    if (ts.isJSDocSeeTag(tag) && tag.name) {
      comment = `${tag.name.getText()}${comment ?? ''}`;
    }
    // Consumers read `escapedText`; `text` mirrors the raw compodoc tag-node shape.
    const tagName: { text: string; escapedText: string } = { text: name, escapedText: name };
    return { tagName, ...(comment === undefined ? {} : { comment }) };
  });
}

/** The optional `jsdoctags` field, spread into a class or member record. */
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
