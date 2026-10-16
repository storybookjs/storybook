import MagicString from 'magic-string';

import {
  type E,
  type Node,
  type ParsedModule,
  type Property,
  isNode,
  parseModule,
  registerSource,
  sourceOf,
  walk,
} from './ast.ts';
import { type ScopeInfo, analyzeScopes } from './scope.ts';

type Span = { start: number; end: number };

/**
 * Source text plus its OXC AST. Edits accumulate in `edits`, so untouched code stays
 * byte-identical; `commit()` applies them and parses the result again.
 */
export class SourceEditor {
  _module: ParsedModule;

  _scopes: ScopeInfo | undefined;

  _parents: Map<Node, Node | null> | undefined;

  _edits: MagicString;

  readonly fileName: string | undefined;

  constructor(code: string, fileName?: string) {
    this.fileName = fileName;
    this._module = parseModule(code, fileName);
    this._edits = new MagicString(code, { filename: fileName });
  }

  get code() {
    return this._module.code;
  }

  get program() {
    return this._module.program;
  }

  get comments() {
    return this._module.comments;
  }

  get scopes() {
    this._scopes ??= analyzeScopes(this._module.program);
    return this._scopes;
  }

  /** Parent of a node in this source; building the map also registers every node's source text. */
  parentOf(node: Node): Node | null {
    if (!this._parents) {
      const parents = new Map<Node, Node | null>();
      walk(this._module.program, (child, parent) => {
        parents.set(child, parent);
      });
      registerSource(this._module.program, this._module.code);
      this._parents = parents;
    }
    return this._parents.get(node) ?? null;
  }

  /** Innermost statement or declaration containing a node. */
  statementOf(node: Node): Node | undefined {
    for (let current: Node | null = node; current; current = this.parentOf(current)) {
      if (/(Statement|Declaration)$/.test(current.type) && current.type !== 'Program') {
        return current;
      }
    }
    return undefined;
  }

  get edits() {
    return this._edits;
  }

  get pending() {
    return this._edits.hasChanged();
  }

  source(node: Span) {
    return sourceOf(this.code, node);
  }

  /** Apply pending edits and parse the result again. Returns whether anything changed. */
  commit() {
    if (!this.pending) {
      return false;
    }
    this.replaceSource(this._edits.toString());
    return true;
  }

  replaceSource(code: string) {
    this._module = parseModule(code, this.fileName);
    this._scopes = undefined;
    this._parents = undefined;
    this._edits = new MagicString(code, { filename: this.fileName });
  }

  /** Line ending of the file; inserted text is written with `\n` and converted on output. */
  get eol(): '\n' | '\r\n' {
    return this.code.includes('\r\n') ? '\r\n' : '\n';
  }

  toString() {
    const code = this._edits.toString();
    return this.eol === '\r\n' ? code.replace(/\r?\n/g, '\r\n') : code;
  }

  /** Quote for generated strings, overriding the inferred one. */
  preferredQuote: "'" | '"' | undefined;

  /** Quote for generated strings; defaults to the style of the first string literal. */
  get quote(): "'" | '"' {
    if (this.preferredQuote) {
      return this.preferredQuote;
    }
    const match = /(?:^|[\s,:([{=])(['"])/.exec(this.code);
    return match?.[1] === '"' ? '"' : "'";
  }
}

const isIdentifierName = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name);

export const printKey = (name: string, quote: string) =>
  isIdentifierName(name) ? name : printString(name, quote);

export const printString = (value: string, quote: string) => {
  const json = JSON.stringify(value);
  return quote === '"'
    ? json
    : `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`;
};

export const printValue = (value: unknown, quote: string): string => {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return printString(value, quote);
  }
  if (typeof value === 'number') {
    if (Object.is(value, -0)) {
      return '-0';
    }
    return Number.isFinite(value)
      ? String(value)
      : value > 0
        ? 'Infinity'
        : value < 0
          ? '-Infinity'
          : 'NaN';
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${Array.from(value, (item) => printValue(item, quote)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0
      ? '{}'
      : `{ ${entries.map(([key, item]) => `${printKey(key, quote)}: ${printValue(item, quote)}`).join(', ')} }`;
  }
  throw new Error(`Cannot print value of type ${typeof value}`);
};

// Index just past the next `token` at or after `from`, skipping whitespace and comments.
const scanFor = (code: string, from: number, until: number, token: string): number | undefined => {
  let index = from;
  while (index < until) {
    const char = code[index];
    if (char === token) {
      return index + 1;
    }
    if (code.startsWith('//', index)) {
      const end = code.indexOf('\n', index);
      index = end === -1 ? until : end + 1;
    } else if (code.startsWith('/*', index)) {
      const end = code.indexOf('*/', index + 2);
      index = end === -1 ? until : end + 2;
    } else if (/\s/.test(char)) {
      index++;
    } else {
      return undefined;
    }
  }
  return undefined;
};

/**
 * A comma-separated list in the source: object members, array elements, import specifiers. `open`
 * is the index right after the opening token, `close` the index of the closing token.
 */
export interface List {
  open: number;
  close: number;
  items: readonly Span[];
}

export const objectList = (object: E.ObjectExpression | E.ObjectPattern): List => ({
  open: object.start + 1,
  close: object.end - 1,
  items: object.properties,
});

// Nodes are parsed without parentheses, so an element's span may sit inside `( )`.
export const arrayList = (editor: SourceEditor, array: E.ArrayExpression): List => ({
  open: array.start + 1,
  close: array.end - 1,
  items: array.elements
    .filter((element): element is NonNullable<typeof element> => !!element)
    .map((element) => withParentheses(editor.code, element, array.start + 1, array.end - 1)),
});

/** Widen a span to the balanced parentheses wrapped directly around it, within `lower..upper`. */
export const withParentheses = (code: string, span: Span, lower = 0, upper = code.length): Span => {
  let { start, end } = span;
  while (true) {
    let before = start;
    while (before > lower && /\s/.test(code[before - 1])) {
      before--;
    }
    let after = end;
    while (after < upper && /\s/.test(code[after])) {
      after++;
    }
    if (before > lower && after < upper && code[before - 1] === '(' && code[after] === ')') {
      start = before - 1;
      end = after + 1;
    } else {
      return start === span.start && end === span.end ? span : { start, end };
    }
  }
};

// Position right after the token that precedes an item: the comma or the opening token.
export const separatorBefore = (code: string, list: List | E.ObjectExpression, index: number) => {
  const { open, items } = 'open' in list ? list : objectList(list);
  if (index === 0) {
    return open;
  }
  const previous = items[index - 1];
  return scanFor(code, previous.end, items[index].start, ',') ?? previous.end;
};

// Position right after the comma that follows an item, if it has one.
const separatorAfter = (code: string, list: List, index: number) => {
  const item = list.items[index];
  const until = list.items[index + 1]?.start ?? list.close;
  return scanFor(code, item.end, until, ',');
};

export const lineIndent = (code: string, index: number) => {
  const lineStart = code.lastIndexOf('\n', index - 1) + 1;
  return /^[ \t]*/.exec(code.slice(lineStart))![0];
};

const isMultiline = (code: string, list: List) => code.slice(list.open, list.close).includes('\n');

// Offsets of the line breaks in `text` that separate code, excluding those inside string and
// template literals, whose line breaks are part of the value.
const codeLineBreaks = (text: string) => {
  const breaks: number[] = [];
  type Context = 'template' | { depth: number };
  const stack: Context[] = [{ depth: 0 }];
  let quote: string | undefined;
  let comment: 'line' | 'block' | undefined;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const top = stack.at(-1)!;
    if (quote) {
      if (char === '\\') {
        index++;
      } else if (char === quote || char === '\n') {
        quote = undefined;
      }
    } else if (comment === 'line') {
      if (char === '\n') {
        comment = undefined;
        breaks.push(index);
      }
    } else if (comment === 'block') {
      if (char === '\n') {
        breaks.push(index);
      } else if (text.startsWith('*/', index)) {
        comment = undefined;
        index++;
      }
    } else if (top === 'template') {
      if (char === '\\') {
        index++;
      } else if (char === '`') {
        stack.pop();
      } else if (text.startsWith('${', index)) {
        stack.push({ depth: 0 });
        index++;
      }
    } else if (char === '\n') {
      breaks.push(index);
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '`') {
      stack.push('template');
    } else if (text.startsWith('//', index)) {
      comment = 'line';
    } else if (text.startsWith('/*', index)) {
      comment = 'block';
    } else if (char === '{') {
      top.depth++;
    } else if (char === '}') {
      if (top.depth === 0 && stack.length > 1) {
        stack.pop();
      } else {
        top.depth--;
      }
    }
  }
  return breaks;
};

/** Re-indent the continuation lines of `text`, leaving string and template literal values alone. */
export const reindent = (text: string, from: string, to: string) => {
  if (from === to || !text.includes('\n')) {
    return text;
  }
  let result = '';
  let cursor = 0;
  for (const lineBreak of codeLineBreaks(text)) {
    result += text.slice(cursor, lineBreak + 1);
    cursor = lineBreak + 1;
    if (text.startsWith(from, cursor)) {
      result += to;
      cursor += from.length;
    }
  }
  return result + text.slice(cursor);
};

/** Text of an item including the comments that lead it, with continuation lines dedented. */
export const itemText = (editor: SourceEditor, list: List, item: Span) => {
  const start = separatorBefore(editor.code, list, list.items.indexOf(item));
  const raw = editor.code.slice(start, item.end).replace(/^\s+/, '');
  return reindent(raw, lineIndent(editor.code, item.start), '');
};

export const memberText = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: E.ObjectPropertyKind
) => itemText(editor, objectList(object), member);

export const appendToList = (
  editor: SourceEditor,
  list: List,
  texts: string[],
  // Padding inside an empty single-line list: `{ a }` for objects, `[a]` for arrays.
  padding = ' '
) => {
  const { code, edits } = editor;
  const { items } = list;
  if (items.length === 0) {
    const inner = code.slice(list.open, list.close);
    if ((inner.includes('\n') && inner.trim()) || texts.some((text) => text.includes('\n'))) {
      // Multi-line items, or only comments inside: lay the items out one per line.
      const outer = lineIndent(code, list.open - 1);
      const indent = `${outer}  `;
      const lead = inner.trim() ? '' : '\n';
      if (!inner.trim() && list.close > list.open) {
        edits.remove(list.open, list.close);
      }
      edits.appendLeft(
        list.close,
        `${lead}${texts.map((text) => `${indent}${reindent(text, '', indent)},`).join('\n')}\n${outer}`
      );
      return;
    }
    const content = `${padding}${texts.join(', ')}${padding}`;
    if (list.close > list.open) {
      edits.overwrite(list.open, list.close, content);
    } else {
      edits.appendLeft(list.open, content);
    }
    return;
  }
  const last = items.at(-1)!;
  const trailingComma = separatorAfter(code, list, items.length - 1);
  if (isMultiline(code, list)) {
    const indent = lineIndent(code, last.start);
    const block = texts.map((text) => `${indent}${reindent(text, '', indent)}`).join(',\n');
    if (trailingComma !== undefined) {
      edits.appendLeft(trailingComma, `\n${block},`);
    } else {
      edits.appendLeft(last.end, `,\n${block}`);
    }
    return;
  }
  if (trailingComma !== undefined) {
    edits.appendLeft(trailingComma, ` ${texts.join(', ')},`);
  } else {
    edits.appendLeft(last.end, `, ${texts.join(', ')}`);
  }
};

export const prependToList = (editor: SourceEditor, list: List, texts: string[], padding = ' ') => {
  const { code, edits } = editor;
  const [first] = list.items;
  if (!first) {
    appendToList(editor, list, texts, padding);
    return;
  }
  if (isMultiline(code, list)) {
    const indent = lineIndent(code, first.start);
    edits.appendRight(
      list.open,
      `\n${texts.map((text) => `${indent}${reindent(text, '', indent)},`).join('\n')}`
    );
    return;
  }
  edits.appendRight(first.start, `${texts.join(', ')}, `);
};

/** Remove items with their leading comments and separators from a list. */
export const removeFromList = (editor: SourceEditor, list: List, removedItems: readonly Span[]) => {
  const { code, edits } = editor;
  const { items } = list;
  // A list item may be a widened span, so an item is removed when it contains a removed span.
  const removed = new Set(
    items.filter((item) =>
      removedItems.some((span) => item.start <= span.start && span.end <= item.end)
    )
  );
  if (items.every((item) => removed.has(item))) {
    if (list.close > list.open) {
      edits.remove(list.open, list.close);
    }
    return;
  }
  const keptIndexes = items.flatMap((item, index) => (removed.has(item) ? [] : [index]));
  const lastKept = keptIndexes.at(-1)!;
  items.forEach((item, index) => {
    if (!removed.has(item)) {
      return;
    }
    const after = separatorAfter(code, list, index);
    if (index > lastKept && after === undefined) {
      // Trailing item without a comma: drop the comma of the last kept item instead.
      const previous = items[lastKept];
      const comma = separatorAfter(code, list, lastKept)!;
      edits.remove(previous.end, comma);
      edits.remove(comma, item.end);
      return;
    }
    edits.remove(separatorBefore(code, list, index), after ?? item.end);
  });
};

export const appendMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  appendToList(editor, objectList(object), texts);

export const prependMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  prependToList(editor, objectList(object), texts);

export const removeMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: readonly E.ObjectPropertyKind[]
) => removeFromList(editor, objectList(object), members);

const NEXT_LINE_DIRECTIVE =
  /^\s*(@ts-(expect-error|ignore)|[a-z]+-disable-next-line|prettier-ignore|biome-ignore)\b/;

const leadingDirectives = (editor: SourceEditor) =>
  editor.program.body.filter((statement) => 'directive' in statement && statement.directive);

/**
 * Comments leading the file's first statement that form the file header, such as a license. A
 * directive that applies only to that statement, such as `@ts-expect-error`, ends the header.
 */
export const headerComments = (editor: SourceEditor): E.Comment[] => {
  const directives = leadingDirectives(editor);
  const first = editor.program.body[directives.length];
  const from = directives.at(-1)?.end ?? 0;
  const leading = editor.comments.filter(
    (comment) => comment.start >= from && first && comment.end <= first.start
  );
  const directive = leading.findIndex(({ value }) => NEXT_LINE_DIRECTIVE.test(value));
  return directive === -1 ? leading : leading.slice(0, directive);
};

/**
 * Insert a statement before the first non-directive statement, above its leading comments. A file
 * header stays first: the statement goes below the leading imports, or below the header itself.
 */
export const prependStatement = (editor: SourceEditor, text: string) => {
  const { body } = editor.program;
  const directives = leadingDirectives(editor);
  const after =
    directives.at(-1)?.end ?? (editor.code.startsWith('#!') ? editor.code.indexOf('\n') + 1 : 0);
  const first = body[directives.length];
  if (!first) {
    editor.edits.appendLeft(after, `${after > 0 ? '\n' : ''}${text}\n`);
    return;
  }
  const header = headerComments(editor);
  if (header.length > 0) {
    const statements = body.slice(directives.length);
    const imports = statements.findIndex((statement) => statement.type !== 'ImportDeclaration');
    const lastImport = imports === -1 ? statements.at(-1) : statements[imports - 1];
    if (lastImport) {
      editor.edits.appendLeft(lastImport.end, `\n${text}`);
      return;
    }
    const headerEnd = header.at(-1)!.end;
    const next = headerEnd + /^\s*/.exec(editor.code.slice(headerEnd))![0].length;
    editor.edits.appendRight(next, `${text}\n\n`);
    return;
  }
  const start = after + /^\s*/.exec(editor.code.slice(after))![0].length;
  editor.edits.appendRight(start, `${text}\n`);
};

export const appendStatement = (editor: SourceEditor, text: string) => {
  const last = editor.program.body.at(-1);
  if (!last) {
    editor.edits.append(
      `${editor.code.length > 0 && !editor.code.endsWith('\n') ? '\n' : ''}${text}\n`
    );
    return;
  }
  editor.edits.appendLeft(last.end, `\n${text}`);
};

/**
 * Comments that lead a statement on their own lines, above it. The file header stays when the
 * first statement is removed.
 */
export const leadingComments = (editor: SourceEditor, statement: Span): E.Comment[] => {
  const { code, comments } = editor;
  const previous = editor.program.body.filter((node) => node.end <= statement.start).at(-1);
  const previousLineEnd = previous ? code.indexOf('\n', previous.end) : -1;
  const from = previousLineEnd === -1 && previous ? previous.end : previousLineEnd + 1;
  const header = new Set(previous ? [] : headerComments(editor));
  return comments.filter(
    (comment) => comment.start >= from && comment.end <= statement.start && !header.has(comment)
  );
};

/** Remove a statement with its leading comments, and its line when nothing else shares it. */
export const removeStatement = (editor: SourceEditor, statement: Span) => {
  const { code } = editor;
  const first = leadingComments(editor, statement)[0];
  const lineStart = code.lastIndexOf('\n', (first ?? statement).start - 1) + 1;
  const lineEnd = code.indexOf('\n', statement.end);
  const before = code.slice(lineStart, (first ?? statement).start);
  const after = code.slice(statement.end, lineEnd === -1 ? code.length : lineEnd);
  if (!before.trim() && !after.trim()) {
    editor.edits.remove(lineStart, lineEnd === -1 ? code.length : lineEnd + 1);
  } else {
    editor.edits.remove((first ?? statement).start, statement.end);
  }
};

export const replaceValue = (editor: SourceEditor, member: Property, text: string) => {
  if (member.shorthand) {
    editor.edits.overwrite(member.start, member.end, `${editor.source(member.key)}: ${text}`);
    return;
  }
  if (member.method || member.kind !== 'init') {
    const method = methodFromFunction(text, keySource(editor, member));
    editor.edits.overwrite(
      member.start,
      member.end,
      method ?? `${keySource(editor, member)}: ${text}`
    );
    return;
  }
  editor.edits.overwrite(member.value.start, member.value.end, text);
};

export const keySource = (editor: SourceEditor, member: Property) => {
  if (!member.computed) {
    return editor.source(member.key);
  }
  const open = editor.code.lastIndexOf('[', member.key.start);
  const close = editor.code.indexOf(']', member.key.end);
  return editor.code.slice(open, close + 1);
};

const keyRange = (editor: SourceEditor, member: Property): Span => {
  if (!member.computed) {
    return member.key;
  }
  return {
    start: editor.code.lastIndexOf('[', member.key.start),
    end: editor.code.indexOf(']', member.key.end) + 1,
  };
};

// Renames a member's key in place, keeping methods methods and expanding shorthands.
export const renameKey = (editor: SourceEditor, member: Property, key: string) => {
  if (member.shorthand) {
    editor.edits.overwrite(member.start, member.end, `${key}: ${editor.source(member.value)}`);
    return;
  }
  const range = keyRange(editor, member);
  editor.edits.overwrite(range.start, range.end, key);
};

// The member's text with its key renamed, as `memberText` would print it.
export const renamedMemberText = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: Property,
  key: string
) => {
  const list = objectList(object);
  const start = separatorBefore(editor.code, list, list.items.indexOf(member));
  const { code } = editor;
  const renamed = member.shorthand
    ? code.slice(start, member.start) + `${key}: ${editor.source(member.value)}`
    : code.slice(start, keyRange(editor, member).start) +
      key +
      code.slice(keyRange(editor, member).end, member.end);
  return reindent(renamed.replace(/^\s+/, ''), lineIndent(code, member.start), '');
};

// Function expression source for a method, so reads and transforms of `play() {}` see a value.
// `async *play(a) {}` becomes `async function* (a) {}`.
export const functionFromMethod = (editor: SourceEditor, member: Property) => {
  const fn = member.value as E.Function;
  const range = keyRange(editor, member);
  const rest = editor.code.slice(range.end, member.end);
  return `${fn.async ? 'async ' : ''}function${fn.generator ? '*' : ''} ${rest.replace(/^\s*/, '')}`;
};

const methodFromFunction = (text: string, key: string) => {
  const match = /^(async\s+)?function\s*(\*)?\s*(?=[(<])/.exec(text);
  return match
    ? `${match[1] ? 'async ' : ''}${match[2] ? '*' : ''}${key}${text.slice(match[0].length)}`
    : undefined;
};

export const isSpan = (value: unknown): value is Span =>
  isNode(value) && typeof (value as unknown as Span).start === 'number';

export type { Node };
