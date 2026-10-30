import type * as tsModule from 'typescript';
import type { DocgenTypeScript } from '@storybook/component-meta-typescript';

import type { JsDocTag } from '../types.ts';

const decorationStripped = (line: string): string | undefined =>
  line.match(/^[ \t]*\*(?!\*)[ \t]?(.*)$/)?.[1];

const indentWidth = (line: string): number => line.match(/^[ \t]*/)![0].length;

// TypeScript's own comment text treats the first `*` of an undecorated `**bold**` line as margin
// decoration and drops it, so the text is rebuilt from the source instead.
const cleanCommentText = (raw: string): string => {
  const lines = raw.split('\n').map((line) => line.replace(/\r$/, ''));
  const undecorated = lines
    .slice(1)
    .filter((line) => line.trim() !== '' && decorationStripped(line) === undefined);
  const margin = undecorated.length === 0 ? 0 : Math.min(...undecorated.map(indentWidth));
  const cleaned = lines.map((line, index) => {
    if (line.trim() === '') {
      return '';
    }
    const stripped = decorationStripped(line);
    if (stripped !== undefined) {
      return stripped;
    }
    return index === 0 ? line.replace(/^[ \t]+/, '') : line.slice(margin);
  });
  while (cleaned.length > 0 && cleaned[0] === '') {
    cleaned.shift();
  }
  return cleaned.join('\n');
};

// TypeScript 7.1 starts a JSDoc node at the trivia before it, comments included.
const jsDocStart = (sourceText: string, pos: number): number => {
  let at = pos;
  while (at < sourceText.length && !sourceText.startsWith('/**', at)) {
    if (sourceText.startsWith('//', at)) {
      const lineEnd = sourceText.indexOf('\n', at);
      at = lineEnd < 0 ? sourceText.length : lineEnd + 1;
    } else if (sourceText.startsWith('/*', at)) {
      const close = sourceText.indexOf('*/', at + 2);
      at = close < 0 ? sourceText.length : close + 2;
    } else {
      at += 1;
    }
  }
  return at;
};

const rawJsDocComment = (sourceText: string, jsDoc: tsModule.JSDoc): string => {
  const end = jsDoc.tags?.length ? jsDoc.tags[0].pos : jsDoc.end;
  return sourceText
    .slice(jsDocStart(sourceText, jsDoc.pos), end)
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '');
};

const rawTagComment = (
  ts: DocgenTypeScript,
  sourceText: string,
  tag: tsModule.JSDocTag
): string | undefined => {
  let start: number | undefined;
  // TypeScript 7.1's native nodes name a `@see` tag's reference `nameExpression`.
  const seeName =
    ts.isJSDocSeeTag(tag) &&
    (tag.name ?? (tag as { nameExpression?: tsModule.Node }).nameExpression);
  if (seeName) {
    start = seeName.pos;
  } else if (tag.comment !== undefined) {
    // After the tag's own parts, never at its comment: TypeScript 7.1 parses every comment into
    // nodes that begin after the line's `*` decoration, which cleanCommentText would strip again.
    const commentStart = typeof tag.comment === 'string' ? tag.end : tag.comment.pos;
    let end = tag.tagName.end;
    const afterPart = (part: { end: number }) => {
      if (part.end <= commentStart) {
        end = Math.max(end, part.end);
      }
    };
    // A native node array carries no position of its own; its elements do.
    ts.forEachChild(tag, afterPart, (parts) => parts.forEach(afterPart));
    start = end;
  }
  return start === undefined
    ? undefined
    : cleanCommentText(sourceText.slice(start, tag.end)).trimEnd();
};

// `description` and `rawdescription` both carry the same plain text; nothing downstream parses it
// as HTML, unlike the Markdown-rendered comments Compodoc produced.
export function getJsDocDescription(
  ts: DocgenTypeScript,
  node: tsModule.Node
): { description?: string; rawdescription?: string } {
  const sourceText = node.getSourceFile().text;
  const jsDoc = ts
    .getJSDocCommentsAndTags(node)
    .filter((doc): doc is tsModule.JSDoc => ts.isJSDoc(doc))
    .at(-1);
  let text =
    jsDoc?.comment === undefined ? undefined : cleanCommentText(rawJsDocComment(sourceText, jsDoc));
  // `/*****`-style openers leak pure-asterisk lines into the comment text.
  text = text?.replace(/^(?:[ \t]*\*+[ \t]*\n)+/, '').replace(/^[ \t]*\*+[ \t]*$/, '');
  // An explicit `@description` tag wins: the text before it is usually a `property foo` header,
  // not prose.
  const descriptionTag = ts
    .getJSDocTags(node)
    .find((tag) => tag.tagName.text === 'description' && tag.comment !== undefined);
  if (descriptionTag) {
    text = cleanCommentText(sourceText.slice(descriptionTag.tagName.end, descriptionTag.end));
  }
  const trimmed = text?.replace(/\s+$/, '');
  if (!trimmed) {
    return {};
  }
  return { description: trimmed, rawdescription: trimmed };
}

function getJsDocTags(ts: DocgenTypeScript, node: tsModule.Node): JsDocTag[] | undefined {
  const tags = ts.getJSDocTags(node);
  if (tags.length === 0) {
    return undefined;
  }
  const sourceText = node.getSourceFile().text;
  return tags.map((tag) => {
    const name = tag.tagName.text;
    const comment = rawTagComment(ts, sourceText, tag);
    // Consumers read `escapedText`; `text` mirrors the raw TypeScript tag-node shape.
    const tagName: { text: string; escapedText: string } = { text: name, escapedText: name };
    return { tagName, ...(comment === undefined ? {} : { comment }) };
  });
}

export function getJsDocTagsField(
  ts: DocgenTypeScript,
  node: tsModule.Node
): { jsdoctags?: JsDocTag[] } {
  const tags = getJsDocTags(ts, node);
  return tags ? { jsdoctags: tags } : {};
}

export function hasJsDocTag(ts: DocgenTypeScript, node: tsModule.Node, tagName: string): boolean {
  return ts.getJSDocTags(node).some((tag) => tag.tagName.text === tagName);
}
