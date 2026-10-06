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

// Source text plus its OXC AST. Edits accumulate in a `MagicString` over the current text, so
// untouched code stays byte-identical and source maps come for free. `commit()` flattens pending
// edits and re-parses, which mutation APIs call before reading the file again.
export class SourceEditor {
  #module: ParsedModule;

  #scopes: ScopeInfo | undefined;

  #parents: Map<Node, Node | null> | undefined;

  #edits: MagicString;

  readonly fileName: string | undefined;

  constructor(code: string, fileName?: string) {
    this.fileName = fileName;
    this.#module = parseModule(code, fileName);
    this.#edits = new MagicString(code, { filename: fileName });
  }

  get code() {
    return this.#module.code;
  }

  get program() {
    return this.#module.program;
  }

  get comments() {
    return this.#module.comments;
  }

  get scopes() {
    this.#scopes ??= analyzeScopes(this.#module.program);
    return this.#scopes;
  }

  /** Parent of a node in this source; building the map also registers every node's source text. */
  parentOf(node: Node): Node | null {
    if (!this.#parents) {
      const parents = new Map<Node, Node | null>();
      walk(this.#module.program, (child, parent) => {
        parents.set(child, parent);
      });
      registerSource(this.#module.program, this.#module.code);
      this.#parents = parents;
    }
    return this.#parents.get(node) ?? null;
  }

  /** Innermost statement or declaration containing a node, like Babel's `getStatementParent`. */
  statementOf(node: Node): Node | undefined {
    for (let current: Node | null = node; current; current = this.parentOf(current)) {
      if (/(Statement|Declaration)$/.test(current.type) && current.type !== 'Program') {
        return current;
      }
    }
    return undefined;
  }

  get edits() {
    return this.#edits;
  }

  get pending() {
    return this.#edits.hasChanged();
  }

  source(node: Span) {
    return sourceOf(this.code, node);
  }

  // Flattens pending edits into the source and re-parses it. Returns whether anything changed.
  commit() {
    if (!this.pending) {
      return false;
    }
    this.replaceSource(this.#edits.toString());
    return true;
  }

  replaceSource(code: string) {
    this.#module = parseModule(code, this.fileName);
    this.#scopes = undefined;
    this.#parents = undefined;
    this.#edits = new MagicString(code, { filename: this.fileName });
  }

  toString() {
    return this.#edits.toString();
  }

  // Quote style for generated strings, when the owner of this source has decided one.
  preferredQuote: "'" | '"' | undefined;

  // Quote character for generated strings; defaults to the style of the first string literal.
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

// Source for a plain value, matching what Babel's `valueToNode` produced.
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

// A comma-separated list in the source: object members, array elements, import specifiers.
// `open` is the index right after the opening token, `close` the index of the closing token.
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

export const arrayList = (array: E.ArrayExpression): List => ({
  open: array.start + 1,
  close: array.end - 1,
  items: array.elements.filter((element): element is NonNullable<typeof element> => !!element),
});

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

export const reindent = (text: string, from: string, to: string) =>
  from === to
    ? text
    : text
        .split('\n')
        .map((line, index) =>
          index === 0 ? line : line.startsWith(from) ? to + line.slice(from.length) : line
        )
        .join('\n');

// Text of an item including the comments that lead it, with continuation lines dedented.
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

// Removes items (with their leading comments and separators) from a list.
export const removeFromList = (editor: SourceEditor, list: List, removedItems: readonly Span[]) => {
  const { code, edits } = editor;
  const { items } = list;
  const removed = new Set(removedItems);
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

// Inserts a statement before the first non-directive statement, above its leading comments.
export const prependStatement = (editor: SourceEditor, text: string) => {
  const { body } = editor.program;
  const directives = body.filter((statement) => 'directive' in statement && statement.directive);
  const after =
    directives.at(-1)?.end ?? (editor.code.startsWith('#!') ? editor.code.indexOf('\n') + 1 : 0);
  const first = body[directives.length];
  if (!first) {
    editor.edits.appendLeft(after, `${after > 0 ? '\n' : ''}${text}\n`);
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

// Removes a statement together with its line when nothing else shares the line.
export const removeStatement = (editor: SourceEditor, statement: Span) => {
  const { code } = editor;
  const lineStart = code.lastIndexOf('\n', statement.start - 1) + 1;
  const lineEnd = code.indexOf('\n', statement.end);
  const before = code.slice(lineStart, statement.start);
  const after = code.slice(statement.end, lineEnd === -1 ? code.length : lineEnd);
  if (!before.trim() && !after.trim()) {
    editor.edits.remove(lineStart, lineEnd === -1 ? code.length : lineEnd + 1);
  } else {
    editor.edits.remove(statement.start, statement.end);
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

// A member's source with its key replaced, for moving it to another object.
export const renamedMemberText = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: Property,
  key: string
) => {
  const text = memberText(editor, object, member);
  if (member.shorthand) {
    return (
      text.slice(0, text.length - (member.end - member.start)) +
      `${key}: ${editor.source(member.value)}`
    );
  }
  const range = keyRange(editor, member);
  const offset = text.length - (member.end - range.start);
  return text.slice(0, offset) + key + text.slice(offset + (range.end - range.start));
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
