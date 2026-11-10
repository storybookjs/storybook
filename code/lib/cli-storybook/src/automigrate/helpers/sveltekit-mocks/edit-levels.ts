import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  appendToList,
  arrayList,
  detachedTextOf,
  isIdentifier,
  lineIndent,
  objectList,
  objectProperty,
  outerSpan,
  prependToList,
  reindent,
  removeFromList,
  unwrapExpression,
  wrapExpression,
} from 'storybook/internal/csf-tools';

import { KEY, objectValue } from './mock-statements.ts';
import { printStatements } from './print-mocks.ts';

const INLINE_FALSE = 'docs: { story: { inline: false } }';

// The `parameters.sveltekit_experimental` of an object literal: a story, a meta or a preview.
export interface ObjectSite {
  object: E.ObjectExpression;
  parameters: E.ObjectProperty;
  params: E.ObjectExpression;
  sveltekit: E.ObjectProperty;
}

export const findObjectSite = (object: E.ObjectExpression): ObjectSite | undefined => {
  const parameters = objectProperty(object, 'parameters');
  const params = parameters && !parameters.method && objectValue(parameters.value);
  const sveltekit = params && objectProperty(params, KEY);
  return sveltekit ? { object, parameters: parameters!, params, sveltekit } : undefined;
};

export const arrowFunction = (statements: string[], step: string) =>
  `() => {\n${printStatements(statements, step)}\n}`;

// Run `statements` first in an existing `beforeEach`: at the start of a function's body, or in a
// function before the others of an array or the expression that gives the function.
export const prependToBeforeEach = (
  editor: SourceEditor,
  value: Node,
  statements: string[],
  { semicolon, step }: { semicolon: string; step: string }
) => {
  const { code } = editor;
  const fn = unwrapExpression(value);
  if (
    fn.type === 'ArrowFunctionExpression' ||
    fn.type === 'FunctionExpression' ||
    fn.type === 'FunctionDeclaration'
  ) {
    const outer = lineIndent(code, fn.start);
    const body = fn.body!;
    if (body.type !== 'BlockStatement') {
      const returned = `return ${detachedTextOf(body)}${semicolon}`;
      const span = outerSpan(body);
      editor.edits.overwrite(
        span.start,
        span.end,
        `{\n${printStatements([...statements, returned], outer + step)}\n${outer}}`
      );
      return;
    }
    const [first] = body.body;
    // Without semicolons, code that starts with `(`, `[` or a template would continue our last line
    const ended = (next: string | undefined) =>
      !semicolon && next && /^[([`]/.test(next)
        ? [...statements.slice(0, -1), `${statements.at(-1)};`]
        : statements;
    if (first && code.slice(body.start, first.start).includes('\n')) {
      editor.edits.appendLeft(
        body.start + 1,
        `\n${printStatements(ended(code.slice(first.start, first.end)), lineIndent(code, first.start))}`
      );
      return;
    }
    const existing = body.body.map((statement) => detachedTextOf(statement));
    editor.edits.overwrite(
      body.start,
      body.end,
      `{\n${printStatements([...ended(existing[0]), ...existing], outer + step)}\n${outer}}`
    );
    return;
  }
  const indent = lineIndent(code, fn.start);
  const added = reindent(arrowFunction(statements, step), '', indent);
  if (fn.type === 'ArrayExpression') {
    prependToList(editor, arrayList(editor, fn), [arrowFunction(statements, step)]);
    return;
  }
  // Storybook doesn't flatten nested arrays, so a value that can be an array is flattened
  if (isFunctionValue(editor, fn)) {
    wrapExpression(editor, value, `[${added}, `, ']');
  } else {
    wrapExpression(editor, value, `[${added}, ...[`, '].flat()]');
  }
};

// Whether an expression is a function: a function literal, or a name bound to one
const isFunctionValue = (editor: SourceEditor, node: Node) => {
  const binding = node.type === 'Identifier' ? editor.scopes.bindingOf(node) : undefined;
  const init =
    binding?.node.type === 'VariableDeclarator' && binding.node.init
      ? unwrapExpression(binding.node.init)
      : binding?.node;
  return (
    !!init &&
    (init.type === 'ArrowFunctionExpression' ||
      init.type === 'FunctionExpression' ||
      init.type === 'FunctionDeclaration')
  );
};

// After a member and its comma, and a line comment that ends its line
const afterMember = (code: string, member: Node) => {
  const comma = /^[ \t]*,/.exec(code.slice(member.end));
  const end = member.end + (comma?.[0].length ?? 0);
  const comment = /^[ \t]*\/\/[^\n]*/.exec(code.slice(end));
  return { at: end + (comment?.[0].length ?? 0), comma: !!comma };
};

const insertMemberAfter = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: Node,
  text: string
) => {
  const { code } = editor;
  const indent = lineIndent(code, member.start);
  const { at, comma } = afterMember(code, member);
  const added = reindent(text, '', indent);
  if (!code.slice(object.start, object.end).includes('\n')) {
    editor.edits.appendLeft(member.end, `, ${added}`);
    return;
  }
  editor.edits.appendLeft(at, comma ? `\n${indent}${added},` : `,\n${indent}${added}`);
};

// Replace a site's `sveltekit_experimental` with `statements` in the object's `beforeEach`, and
// remove `parameters` once nothing is left in it. With `inlineFalse`, the meta renders its stories
// in iframes on docs pages, as `parameters.docs.story.inline: false`.
export const editObjectSite = (
  editor: SourceEditor,
  site: ObjectSite,
  statements: string[],
  { inlineFalse, semicolon }: { inlineFalse: boolean; semicolon: string }
) => {
  const { object, parameters, params, sveltekit } = site;
  const { code } = editor;
  const docs = inlineFalse ? objectProperty(params, 'docs') : undefined;
  const replacesWithDocs = inlineFalse && !docs;
  const empty = !replacesWithDocs && params.properties.length === 1;
  const existing = objectProperty(object, 'beforeEach');
  const added = `beforeEach() {\n${printStatements(statements, editor.indent)}\n}`;
  // `beforeEach: undefined` sets no hook, so the new one replaces it
  const missing = !!existing && isIdentifier(unwrapExpression(existing.value), 'undefined');
  if (missing && statements.length > 0) {
    editor.edits.overwrite(
      existing.start,
      existing.end,
      reindent(added, '', lineIndent(code, existing.start))
    );
  }
  const beforeEach = missing ? undefined : existing;
  const hasBeforeEach = !!existing && (!missing || statements.length > 0);

  if (statements.length > 0 && beforeEach?.shorthand) {
    const indent = lineIndent(code, beforeEach.start);
    const added = reindent(arrowFunction(statements, editor.indent), '', indent);
    const combined = isFunctionValue(editor, beforeEach.value)
      ? `[${added}, beforeEach]`
      : `[${added}, ...[beforeEach].flat()]`;
    editor.edits.overwrite(beforeEach.start, beforeEach.end, `beforeEach: ${combined}`);
  } else if (statements.length > 0 && beforeEach) {
    prependToBeforeEach(editor, beforeEach.value, statements, { semicolon, step: editor.indent });
  }
  if (replacesWithDocs) {
    editor.edits.overwrite(sveltekit.start, sveltekit.end, docsMember(editor, params, sveltekit));
  } else if (docs) {
    removeFromList(editor, objectList(editor, params), [sveltekit]);
    addInlineFalse(editor, docs);
  }
  if (empty && statements.length > 0 && !hasBeforeEach) {
    editor.edits.overwrite(
      parameters.start,
      parameters.end,
      reindent(added, '', lineIndent(code, parameters.start))
    );
    return;
  }
  if (empty) {
    removeFromList(editor, objectList(editor, object), [parameters]);
  } else if (!inlineFalse) {
    removeFromList(editor, objectList(editor, params), [sveltekit]);
  }
  if (statements.length > 0 && !hasBeforeEach) {
    insertMemberAfter(editor, object, parameters, added);
  }
};

// A property of a shared value that its type may not declare, which TypeScript then needs widened.
// The value can be `undefined`, as `docs: Base.parameters.docs` is when `Base` has no docs.
const readText = (editor: SourceEditor, source: string, keys: string[]) => {
  const path = keys.join('?.');
  if (!/\.[cm]?tsx?$/.test(editor.fileName ?? '')) {
    return /^[\w$.]+$/.test(source) ? `${source}?.${path}` : `(${source})?.${path}`;
  }
  const type = keys.reduceRight((inner, key) => `{ ${key}?: ${inner} }`, 'object');
  return `(${source} as ${type} | undefined)?.${path}`;
};

// A shared value, such as a variable, spread into an object literal that adds `members` to it
const spreadShared = (
  editor: SourceEditor,
  property: E.ObjectProperty,
  members: (source: string) => string
) => {
  const value = unwrapExpression(property.value);
  if (value.type !== 'Identifier' && value.type !== 'MemberExpression') {
    return;
  }
  const source = editor.source(value);
  const spread = `{ ...${source}, ${members(source)} }`;
  // A shorthand `{ docs }` has no value of its own to replace
  if (property.shorthand) {
    editor.edits.overwrite(property.start, property.end, `${source}: ${spread}`);
  } else {
    editor.edits.overwrite(property.value.start, property.value.end, spread);
  }
};

const addInlineFalse = (editor: SourceEditor, docs: E.ObjectProperty) => {
  const docsObject = objectValue(docs.value);
  if (!docsObject) {
    spreadShared(
      editor,
      docs,
      (source) => `story: { ...${readText(editor, source, ['story'])}, inline: false }`
    );
    return;
  }
  const story = objectProperty(docsObject, 'story');
  const storyObject = story && objectValue(story.value);
  if (storyObject) {
    if (!objectProperty(storyObject, 'inline')) {
      appendMember(editor, storyObject, 'inline: false');
    }
  } else if (story) {
    spreadShared(editor, story, () => 'inline: false');
  } else {
    appendMember(
      editor,
      docsObject,
      `story: { ${spreadsOf(editor, docsObject, ['story'])}inline: false }`
    );
  }
};

// What the spreads of an object literal before `member` set at `keys`, as spreads for a new member
// that replaces it, such as `docs` after `...shared`
const spreadsOf = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  keys: string[],
  member?: Node
) =>
  object.properties
    .filter(
      (property): property is E.SpreadElement =>
        property.type === 'SpreadElement' && (!member || property.start < member.start)
    )
    .map((spread) => `...${readText(editor, editor.source(spread.argument), keys)}, `)
    .join('');

// `docs: { story: { inline: false } }` for the parameters `params`, keeping the docs of its spreads
const docsMember = (editor: SourceEditor, params: E.ObjectExpression, member?: Node) =>
  `docs: { ${spreadsOf(editor, params, ['docs'], member)}story: { ${spreadsOf(editor, params, ['docs', 'story'], member)}inline: false } }`;

const appendMember = (editor: SourceEditor, object: E.ObjectExpression, text: string) =>
  appendToList(editor, objectList(editor, object), [text]);

// The meta's `parameters.docs.story.inline`, when object literals hold it
export const inlineOf = (meta: E.ObjectExpression) => {
  const parameters = objectProperty(meta, 'parameters');
  const params = parameters && objectValue(parameters.value);
  const docs = params && objectProperty(params, 'docs');
  const docsObject = docs && objectValue(docs.value);
  const story = docsObject && objectProperty(docsObject, 'story');
  const storyObject = story && objectValue(story.value);
  return storyObject ? objectProperty(storyObject, 'inline') : undefined;
};

// A spread whose docs `inline: false` can't keep: a spread that isn't a name, whose call would run
// again, or a second spread, whose docs replace the docs of the spreads before it
export const uncopiedSpread = (meta: E.ObjectExpression) => {
  const parameters = objectProperty(meta, 'parameters');
  const params = parameters && objectValue(parameters.value);
  const docs = params && objectProperty(params, 'docs');
  const docsObject = docs && objectValue(docs.value);
  // The object literal that gets the new `docs` or `story` member, which copies its spreads
  const target = docs ? docsObject && !objectProperty(docsObject, 'story') && docsObject : params;
  if (!target) {
    return undefined;
  }
  return target.properties
    .filter((property): property is E.SpreadElement => property.type === 'SpreadElement')
    .find((spread, index) => index > 0 || !isName(spread.argument));
};

const isName = (node: Node): boolean => {
  const value = unwrapExpression(node);
  return (
    value.type === 'Identifier' ||
    (value.type === 'MemberExpression' && !value.computed && isName(value.object))
  );
};

export const SPREAD_DOCS_PROBLEM =
  'The file has a docs page, which renders the stories inline, where they share the mocks, so the meta needs `parameters.docs.story.inline: false`. The automigration adds it only next to one spread of a name, and here it would run a spread again or change which spread sets `docs`. Add `inline: false` yourself.';

export const isFalse = (node: Node) => {
  const value = unwrapExpression(node);
  return value.type === 'Literal' && value.value === false;
};

export const INLINE_PROBLEM =
  'The file has a docs page, which renders the stories inline, where they share the mocks, but the meta sets `parameters.docs.story.inline` to a value other than `false`. Set it to `false`.';

// Add `parameters.docs.story.inline: false` to a meta that has no `sveltekit_experimental`.
export const addInlineFalseToMeta = (editor: SourceEditor, meta: E.ObjectExpression) => {
  const parameters = objectProperty(meta, 'parameters');
  if (!parameters) {
    appendMember(editor, meta, `parameters: { ${INLINE_FALSE} }`);
    return;
  }
  const params = objectValue(parameters.value);
  if (!params) {
    spreadShared(
      editor,
      parameters,
      (source) =>
        `docs: { ...${readText(editor, source, ['docs'])}, story: { ...${readText(editor, source, ['docs', 'story'])}, inline: false } }`
    );
    return;
  }
  const docs = objectProperty(params, 'docs');
  if (docs) {
    addInlineFalse(editor, docs);
  } else {
    appendMember(editor, params, docsMember(editor, params));
  }
};

// The tags of a `tags` array, or `undefined` when they can't be read, such as with a spread
export const tagsOf = (value: Node | undefined): string[] | undefined => {
  if (!value) {
    return [];
  }
  const list = unwrapExpression(value);
  if (list.type !== 'ArrayExpression') {
    return undefined;
  }
  const tags = list.elements.map((element) =>
    element?.type === 'Literal' && typeof element.value === 'string' ? element.value : undefined
  );
  return tags.every((tag) => tag !== undefined) ? (tags as string[]) : undefined;
};

// A `beforeEach` added to an object that spreads another one replaces the other one's
export const spreadsBeforeEach = (object: E.ObjectExpression) =>
  object.properties.some((member) => member.type === 'SpreadElement') &&
  !objectProperty(object, 'beforeEach');

export const SPREAD_PROBLEM =
  'The object spreads another one, whose `beforeEach` the new `beforeEach` would replace.';

// Whether autodocs is on for a meta: its tags, or the preview's when the meta doesn't remove it.
// Tags that can't be read count as autodocs: an `inline: false` too many only renders iframes
export const hasAutodocs = (meta: E.ObjectExpression, previewAutodocs: boolean) => {
  const tags = tagsOf(objectProperty(meta, 'tags')?.value);
  return !tags || tags.includes('autodocs') || (previewAutodocs && !tags.includes('!autodocs'));
};
