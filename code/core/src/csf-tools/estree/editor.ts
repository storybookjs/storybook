import remapping, { type SourceMapInput } from '@jridgewell/remapping';
import MagicString, { SourceMap } from 'magic-string';

import {
  type E,
  type Node,
  type ParsedModule,
  type Property,
  isNode,
  isValidIdentifier,
  moduleOf,
  normalizeLineEndings,
  outerSpan,
  parseModule,
  parsePrintable,
  sourceOf,
  walk,
} from './ast.ts';
import { type ScopeInfo, analyzeScopes } from './scope.ts';

type Span = { start: number; end: number };

// Maps in a chain are matched by source name, so every map of an editor uses the same one. A
// private member would make the class nominal and break assignability between `src` and `dist`.
const mapSource = (editor: { fileName: string | undefined }) => editor.fileName ?? 'source';

/** A map whose `sourcesContent` may be unknown for sources an input map did not carry. */
export type GeneratedMap = Omit<SourceMap, 'sourcesContent'> & {
  sourcesContent?: (string | null)[];
  sourceRoot?: string;
};

/** A source map from an earlier transform, as the object or the JSON string it was handed over as. */
export type InputSourceMap =
  | string
  | {
      version: number | string;
      mappings: string;
      sources: (string | null)[];
      sourcesContent?: (string | null)[];
      names?: string[];
      file?: string;
      sourceRoot?: string;
    };

/**
 * Source text plus its OXC AST. Edits accumulate in `edits`, so untouched code stays
 * byte-identical; `commit()` applies them, parses the result again and calls `onCommit`, so whoever
 * derived state from the old tree derives it again. Nodes of an earlier parse index code that is
 * gone: `source()` and the editing functions throw for them. Line endings are normalized to `\n`,
 * so `code`, node offsets and `toString()` all use `\n`.
 */
export class SourceEditor {
  _module: ParsedModule;

  _scopes: ScopeInfo | undefined;

  _parents: Map<Node, Node | null> | undefined;

  _edits: MagicString;

  // Maps of the edits applied by earlier commits, oldest first, so the output still maps to the
  // code the editor was created with.
  _committed: SourceMap[] = [];

  // The code the editor was created with, line endings included: the content its maps name.
  readonly _originalCode: string;

  readonly fileName: string | undefined;

  readonly _onCommit: (() => void) | undefined;

  constructor(code: string, fileName?: string, onCommit?: () => void) {
    this.fileName = fileName;
    this._onCommit = onCommit;
    this._originalCode = code;
    this._module = parsePrintable(code, fileName);
    this._edits = new MagicString(this.code, { filename: fileName });
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

  /** Parent of a node in this source. */
  parentOf(node: Node): Node | null {
    if (!this._parents) {
      const parents = new Map<Node, Node | null>();
      walk(this._module.program, (child, parent) => {
        parents.set(child, parent);
      });
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
    this.assertCurrent(node);
    return sourceOf(this.code, node);
  }

  /** Throw for a node of another parse, such as one from before a commit. */
  assertCurrent(node: Span) {
    const module = moduleOf(node);
    if (module && module !== this._module) {
      throw new Error(
        `Cannot edit a ${(node as Node).type} node of another parse: nodes are stale after \`commit()\`, look them up again`
      );
    }
  }

  /** Apply pending edits and parse the result again. Returns whether anything changed. */
  commit() {
    if (!this.pending) {
      return false;
    }
    this._committed.push(
      this._edits.generateMap({ hires: true, includeContent: true, source: mapSource(this) })
    );
    this._module = parsePrintable(this._edits.toString(), this.fileName);
    this._scopes = undefined;
    this._parents = undefined;
    this._edits = new MagicString(this.code, { filename: this.fileName });
    this._onCommit?.();
    return true;
  }

  /**
   * Hi-res map from the code the editor was created with to `toString()`, through every commit,
   * and through `inputSourceMap` when the code came from an earlier transform. Without an input
   * map, `sourcesContent` is that code as it was passed in, line endings included.
   */
  generateMap(options: { source?: string; inputSourceMap?: InputSourceMap } = {}): GeneratedMap {
    const source = options.source ?? this.fileName ?? '';
    const current = this._edits.generateMap({
      hires: true,
      includeContent: true,
      source: mapSource(this),
    });
    const input =
      typeof options.inputSourceMap === 'string'
        ? (JSON.parse(options.inputSourceMap) as Exclude<InputSourceMap, string>)
        : options.inputSourceMap;
    const chain = [current, ...this._committed.slice().reverse()];
    if (chain.length === 1 && !input) {
      current.sources = [source];
      current.sourcesContent = [this._originalCode];
      return current;
    }
    const maps = chain.map((map) => map as unknown as SourceMapInput);
    if (input) {
      maps.push(input as SourceMapInput);
    }
    // The original sources keep the names the input map spelled them with: remapping resolves
    // them against `sourceRoot` and hands them to the loader in the input map's order. Without an
    // input map the only original source is this editor's, under the requested name.
    let index = 0;
    const composed = remapping(maps, (_file, context) => {
      if (context.depth === 1) {
        context.source = (input ? input.sources[index++] : source) ?? context.source;
      }
      return null;
    });
    const map = new SourceMap({
      file: composed.file ?? '',
      sources: composed.sources as string[],
      // Unknown content stays `null`, so devtools load the file instead of showing it empty.
      sourcesContent: input
        ? (composed.sourcesContent as string[] | undefined)
        : composed.sources.map(() => this._originalCode),
      names: composed.names,
      // Encoded, since `decodedMappings` was not requested.
      mappings: composed.mappings as string,
    }) as GeneratedMap;
    if (input?.sourceRoot) {
      map.sourceRoot = input.sourceRoot;
    }
    return map;
  }

  toString() {
    return this._edits.toString();
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

export const printKey = (name: string, quote: string) =>
  isValidIdentifier(name, false) ? name : printString(name, quote);

export const printString = (value: string, quote: string) => {
  const json = JSON.stringify(value);
  return quote === '"'
    ? json
    : `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`;
};

/** An object literal laid out one member per line, so formatters keep it expanded. */
export const printMembers = (members: string[], unit = '  ') =>
  members.length === 0
    ? '{}'
    : `{\n${members.map((member) => `${unit}${reindent(member, '', unit)},`).join('\n')}\n}`;

/** Print a JS value as source. `expanded` lays objects out one member per line. */
export const printValue = (
  value: unknown,
  quote: string,
  options: { expanded?: boolean } = {}
): string => {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'function') {
    // A function prints as the text of the file it was loaded from, which may use CRLF.
    return normalizeLineEndings(value.toString());
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
    return `[${Array.from(value, (item) => printValue(item, quote, options)).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => `${printKey(key, quote)}: ${printValue(item, quote, options)}`
    );
    if (options.expanded) {
      return printMembers(members);
    }
    return members.length === 0 ? '{}' : `{ ${members.join(', ')} }`;
  }
  throw new Error(`Cannot print value of type ${typeof value}`);
};

const lineStart = (code: string, index: number) =>
  index > 0 ? code.lastIndexOf('\n', index - 1) + 1 : 0;

const lineEnd = (code: string, index: number) => {
  const lineBreak = code.indexOf('\n', index);
  return lineBreak === -1 ? code.length : lineBreak;
};

// Comments are sorted and never overlap, so they are sorted by their ends too.
const commentAt = (editor: SourceEditor, index: number, edge: 'start' | 'end') => {
  const { comments } = editor;
  let low = 0;
  let high = comments.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const position = comments[middle][edge];
    if (position === index) {
      return comments[middle];
    }
    if (position < index) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return undefined;
};

const SPACE = /\s/;
const SPACE_ON_LINE = /[^\S\n]/;

// The comments from `index` on with only `space` around them, and the end of that run.
const triviaAfter = (editor: SourceEditor, index: number, space = SPACE) => {
  const { code } = editor;
  const comments: E.Comment[] = [];
  let end = index;
  while (end < code.length) {
    const comment = commentAt(editor, end, 'start');
    if (comment) {
      comments.push(comment);
      end = comment.end;
    } else if (space.test(code[end])) {
      end++;
    } else {
      break;
    }
  }
  return { comments, end };
};

// The comments up to `index` with only whitespace around them, and the start of that run.
export const triviaBefore = (editor: SourceEditor, index: number) => {
  const { code } = editor;
  const comments: E.Comment[] = [];
  let start = index;
  while (start > 0) {
    const comment = commentAt(editor, start, 'end');
    if (comment) {
      comments.unshift(comment);
      start = comment.start;
    } else if (SPACE.test(code[start - 1])) {
      start--;
    } else {
      break;
    }
  }
  return { comments, start };
};

const nextTokenStart = (editor: SourceEditor, index: number) => triviaAfter(editor, index).end;

const previousTokenEnd = (editor: SourceEditor, index: number) => triviaBefore(editor, index).start;

// The comments after `index` on its line; a block comment may carry the run onto a later line.
const commentsBeside = (editor: SourceEditor, index: number) =>
  triviaAfter(editor, index, SPACE_ON_LINE);

/**
 * A comma-separated list in the source: object members, array elements, import specifiers. `open`
 * is the index right after the opening token, `close` the index of the closing token.
 */
export interface List {
  open: number;
  close: number;
  items: readonly Span[];
}

/** The `{ … }` of an import or export with at least one named specifier. */
export const specifierList = (
  editor: SourceEditor,
  declaration: E.ImportDeclaration | E.ExportNamedDeclaration
): List => {
  editor.assertCurrent(declaration);
  const { code } = editor;
  const items = declaration.specifiers.filter(
    (specifier) => specifier.type === 'ImportSpecifier' || specifier.type === 'ExportSpecifier'
  );
  const afterLast = nextTokenStart(editor, items.at(-1)!.end);
  return {
    open: previousTokenEnd(editor, items[0].start),
    close: code[afterLast] === ',' ? nextTokenStart(editor, afterLast + 1) : afterLast,
    items,
  };
};

export const objectList = (
  editor: SourceEditor,
  object: E.ObjectExpression | E.ObjectPattern
): List => {
  editor.assertCurrent(object);
  return { open: object.start + 1, close: object.end - 1, items: object.properties };
};

// A hole (`[a, , b]`) is an empty item right before the comma that writes it.
const isHole = (item: Span) => item.start === item.end;

// An element's item spans the parentheses around it.
export const arrayList = (editor: SourceEditor, array: E.ArrayExpression): List => {
  editor.assertCurrent(array);
  const open = array.start + 1;
  const close = array.end - 1;
  let cursor = open;
  const items = array.elements.map((element): Span => {
    let item: Span;
    if (element) {
      item = outerSpan(element);
    } else {
      const comma = nextTokenStart(editor, cursor);
      item = { start: comma, end: comma };
    }
    cursor = separatorAfter(editor, item) ?? item.end;
    return item;
  });
  return { open, close, items };
};

// Position right after the comma that follows an item, if it has one.
const separatorAfter = (editor: SourceEditor, item: Span) => {
  const next = nextTokenStart(editor, item.end);
  return editor.code[next] === ',' ? next + 1 : undefined;
};

/** Leading whitespace of the line that `index` is on. */
export const lineIndent = (code: string, index: number) =>
  /^[ \t]*/.exec(code.slice(lineStart(code, index)))![0];

/** Indent step of the file: from an object's line to its first member's, else two spaces. */
export const indentUnit = (code: string, object: E.ObjectExpression | undefined) => {
  const first = object?.properties[0];
  if (!object || !first || !code.slice(object.start, first.start).includes('\n')) {
    return '  ';
  }
  const outer = lineIndent(code, object.start);
  const inner = lineIndent(code, first.start);
  return inner.length > outer.length && inner.startsWith(outer) ? inner.slice(outer.length) : '  ';
};

const isMultiline = (code: string, list: List) => code.slice(list.open, list.close).includes('\n');

// Spans of the literals under `root` whose line breaks are part of their value: strings, regexes
// and template quasis, but not JSX text, which JSX trims. Relative to `range.start`.
const literalSpans = (root: Node, range: Span): Span[] => {
  const spans: Span[] = [];
  walk(root, (node) => {
    const { start, end } = node as Node & Span;
    if (end <= range.start || start >= range.end) {
      return false;
    }
    if (
      node.type === 'TemplateElement' ||
      (node.type === 'Literal' && (typeof node.value === 'string' || 'regex' in node))
    ) {
      spans.push({ start: start - range.start, end: end - range.start });
    }
  });
  return spans;
};

// What text reaching `reindent` may be: statements, an expression, an object member such as a
// method, or a function body.
const FRAGMENTS = [
  ['', ''],
  ['(', '\n)'],
  ['({', '\n})'],
  ['(async function* () ', '\n)'],
] as const;

const parsedLiteralSpans = (text: string): Span[] | undefined => {
  for (const [before, after] of FRAGMENTS) {
    let program: E.Program;
    try {
      program = parseModule(`${before}${text}${after}`).program;
    } catch {
      continue;
    }
    return literalSpans(program, { start: before.length, end: before.length + text.length });
  }
  return undefined;
};

const reindentLines = (text: string, from: string, to: string, literals: readonly Span[]) => {
  let result = '';
  let cursor = 0;
  for (
    let lineBreak = text.indexOf('\n');
    lineBreak !== -1;
    lineBreak = text.indexOf('\n', cursor)
  ) {
    result += text.slice(cursor, lineBreak + 1);
    cursor = lineBreak + 1;
    const inLiteral = literals.some((span) => span.start < lineBreak && lineBreak < span.end);
    if (!inLiteral && text.startsWith(from, cursor)) {
      result += to;
      cursor += from.length;
    }
  }
  return result + text.slice(cursor);
};

/**
 * Re-indent the continuation lines of `text`, leaving string and template literal values alone,
 * and normalize its line endings to `\n`. Text that does not parse keeps its indentation, as its
 * literals cannot be located.
 */
export const reindent = (source: string, from: string, to: string) => {
  const text = normalizeLineEndings(source);
  if (from === to || !text.includes('\n')) {
    return text;
  }
  const literals = parsedLiteralSpans(text);
  return literals ? reindentLines(text, from, to, literals) : text;
};

const dedentSource = (editor: SourceEditor, start: number, end: number, from: string) => {
  const text = editor.code.slice(start, end);
  return from === '' || !text.includes('\n')
    ? text
    : reindentLines(text, from, '', literalSpans(editor.program, { start, end }));
};

// An item owns the comments after its separator when they end the line. Followed by code on that
// line, they lead the next item instead.
const trailingComments = (editor: SourceEditor, separatorEnd: number) => {
  const { comments, end } = commentsBeside(editor, separatorEnd);
  return end === editor.code.length || editor.code[end] === '\n' ? comments : [];
};

// End of an item with its separator and the comments that trail them.
const itemEnd = (editor: SourceEditor, list: List, index: number) => {
  const item = list.items[index];
  const end = separatorAfter(editor, item) ?? item.end;
  return trailingComments(editor, end).at(-1)?.end ?? end;
};

// Start of what an item owns: after the separator before it and the comments trailing that.
const itemStart = (editor: SourceEditor, list: List, index: number) =>
  index === 0 ? list.open : itemEnd(editor, list, index - 1);

// `itemText` with the text from the start of the leading comments printed by `print`.
const itemTextWith = (
  editor: SourceEditor,
  list: List,
  index: number,
  print: (start: number) => string
) => {
  const { code } = editor;
  const item = list.items[index];
  const from = itemStart(editor, list, index);
  const text = print(from + /^\s*/.exec(code.slice(from, item.start))![0].length);
  const trailing = trailingComments(editor, separatorAfter(editor, item) ?? item.end);
  return trailing.length > 0
    ? `${code.slice(trailing[0].start, trailing.at(-1)!.end)}\n${text}`
    : text;
};

/**
 * Text of an item including the comments that lead it, with continuation lines dedented. The
 * comments that trail the item on its line move above it, so a comma can follow the text.
 */
export const itemText = (editor: SourceEditor, list: List, item: Span) => {
  editor.assertCurrent(item);
  return itemTextWith(editor, list, list.items.indexOf(item), (start) =>
    dedentSource(editor, start, item.end, lineIndent(editor.code, item.start))
  );
};

export const memberText = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: E.ObjectPropertyKind
) => itemText(editor, objectList(editor, object), member);

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
  const comma = separatorAfter(editor, last);
  // The comma of a hole writes the hole, so it is no trailing comma to keep.
  const trailingComma = comma === undefined || isHole(last) ? '' : ',';
  if (isMultiline(code, list)) {
    const indent = lineIndent(code, last.start);
    const block = texts.map((text) => `${indent}${reindent(text, '', indent)}`).join(',\n');
    if (comma === undefined) {
      edits.appendLeft(last.end, ',');
    }
    edits.appendLeft(itemEnd(editor, list, items.length - 1), `\n${block}${trailingComma}`);
    return;
  }
  if (comma !== undefined) {
    edits.appendLeft(comma, ` ${texts.join(', ')}${trailingComma}`);
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

/** Remove items with their separators and the comments that lead and trail them from a list. */
export const removeFromList = (editor: SourceEditor, list: List, removedItems: readonly Span[]) => {
  removedItems.forEach((item) => editor.assertCurrent(item));
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
  // Each run of adjacent removed items goes as one span, so what the run leaves joined is judged
  // once, for the whole run.
  for (let first = 0; first < items.length; first++) {
    if (!removed.has(items[first])) {
      continue;
    }
    let last = first;
    while (removed.has(items[last + 1])) {
      last++;
    }
    if (last === items.length - 1 && separatorAfter(editor, items[last]) === undefined) {
      // Trailing run without a comma: drop the comma of the last kept item instead, unless that
      // comma writes a hole. Only the comma: the comments around it stay with the kept item.
      const previous = items[first - 1];
      if (!isHole(previous)) {
        const comma = separatorAfter(editor, previous)!;
        edits.remove(comma - 1, comma);
      }
    }
    const start = itemStart(editor, list, first);
    const end = itemEnd(editor, list, last);
    // Code after the run on its line must not join the line of a line comment before it.
    const joins =
      commentAt(editor, start, 'end')?.type === 'Line' &&
      code.slice(end, lineEnd(code, end)).trim();
    edits.remove(joins ? lineEnd(code, start) + 1 : start, end);
    first = last;
  }
};

export const appendMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  appendToList(editor, objectList(editor, object), texts);

export const prependMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  prependToList(editor, objectList(editor, object), texts);

/** Replace contiguous members with `key: { …members }`, keeping the first member's comments. */
export const groupMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: Property[],
  key: string
) => {
  const list = objectList(editor, object);
  members.forEach((member) => editor.assertCurrent(member));
  const texts = members.map((member) => memberText(editor, object, member));
  const first = list.items.indexOf(members[0]);
  const multiline = editor.code.slice(object.start, object.end).includes('\n');
  removeMembers(editor, object, members.slice(1));
  const { start } = members[0];
  const indent = /[ \t]*$/.exec(editor.code.slice(lineStart(editor.code, start), start))![0];
  const inner = multiline
    ? reindent(printMembers(texts, indentUnit(editor.code, object)), '', indent)
    : `{ ${texts.join(', ')} }`;
  // The comments of the first member move into the group with it.
  const lead = multiline ? `\n${indent}` : ' ';
  editor.edits.overwrite(
    itemStart(editor, list, first),
    members[0].end,
    `${lead}${printKey(key, editor.quote)}: ${inner}`
  );
  const comma = separatorAfter(editor, members[0]) ?? members[0].end;
  if (itemEnd(editor, list, first) > comma) {
    editor.edits.remove(comma, itemEnd(editor, list, first));
  }
};

export const removeMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: readonly E.ObjectPropertyKind[]
) => removeFromList(editor, objectList(editor, object), members);

const NEXT_LINE_DIRECTIVE =
  /^\s*(@ts-(expect-error|ignore)|[a-z]+-disable-next-line|prettier-ignore|biome-ignore)\b/;

const leadingDirectives = (editor: SourceEditor) =>
  editor.program.body.filter((statement) => 'directive' in statement && statement.directive);

const FILE_PRAGMA =
  /^!|@(license|preserve|flow|jsx\w*|(vitest|jest)-environment|ts-nocheck)\b|^\s*eslint-(disable|env)(?![\w-])|^\/\s*<reference\b/;

const isJSDoc = (comment: E.Comment) => comment.type === 'Block' && comment.value.startsWith('*');

/**
 * Comments before the file's first statement that form the file header, such as a license. The
 * JSDoc blocks (unless the statement is an import) and next-line directives such as
 * `@ts-expect-error` directly above the statement belong to it instead, as does everything from
 * such a directive on, unless they are pragmas.
 */
export const headerComments = (editor: SourceEditor): E.Comment[] => {
  const { code } = editor;
  const directives = leadingDirectives(editor);
  const first = editor.program.body[directives.length];
  if (!first) {
    return [];
  }
  const from = directives.at(-1)?.end ?? 0;
  const leading = editor.comments.filter(
    (comment) => comment.start >= from && comment.end <= first.start
  );
  const isDirective = (comment: E.Comment) => NEXT_LINE_DIRECTIVE.test(comment.value);
  // JSDoc documents a declaration; above an import it is a file header such as a license.
  const ownsJSDoc = first.type !== 'ImportDeclaration';
  let owned = leading.length;
  while (
    owned > 0 &&
    ((ownsJSDoc && isJSDoc(leading[owned - 1])) || isDirective(leading[owned - 1])) &&
    !/\n\s*\n/.test(code.slice(leading[owned - 1].end, leading[owned]?.start ?? first.start))
  ) {
    owned--;
  }
  const directive = leading.findIndex(isDirective);
  return (directive === -1 ? leading : leading.slice(0, directive)).filter(
    (comment, index) => index < owned || FILE_PRAGMA.test(comment.value)
  );
};

/**
 * The end of a statement past the comments that follow it on its line, even when another statement
 * follows them. A next-line directive, or a JSDoc block that runs onto later lines, is about the
 * code below instead, and so is everything after it.
 */
export const statementEnd = (editor: SourceEditor, statement: Span) => {
  editor.assertCurrent(statement);
  const { comments } = commentsBeside(editor, statement.end);
  const below = comments.findIndex(
    (comment) =>
      NEXT_LINE_DIRECTIVE.test(comment.value) ||
      (isJSDoc(comment) && editor.source(comment).includes('\n'))
  );
  return (below === -1 ? comments : comments.slice(0, below)).at(-1)?.end ?? statement.end;
};

// Text that would continue a statement not ended by `;` on the line before, such as `[1].map(f)`.
const CONTINUES_STATEMENT = /^[([`+\-/]/;

/**
 * Insert a statement on its own line right after a statement and the comments it owns. What else
 * shares that line moves below the inserted statements.
 */
export const insertStatementAfter = (editor: SourceEditor, statement: Span, text: string) => {
  const { code, edits } = editor;
  const end = statementEnd(editor, statement);
  const next = end + /^[^\S\n]*/.exec(code.slice(end))![0].length;
  const separator = code[statement.end - 1] !== ';' && CONTINUES_STATEMENT.test(text) ? ';' : '';
  if (next === code.length || code[next] === '\n') {
    edits.appendLeft(next, `\n${separator}${text}`);
    return;
  }
  edits.appendLeft(end, `\n${separator}${text}`);
  // The same line break for every statement inserted here.
  if (next > end) {
    edits.overwrite(end, next, '\n');
  } else {
    edits.appendRight(next, '\n');
  }
};

/** Insert a statement after the last import, or as the first statement when there is none. */
export const insertAfterImports = (editor: SourceEditor, text: string) => {
  const lastImport = editor.program.body.findLast((node) => node.type === 'ImportDeclaration');
  if (lastImport) {
    insertStatementAfter(editor, lastImport, text);
  } else {
    prependStatement(editor, text);
  }
};

// A statement leads with the comments between it and the end of the statement before it. The
// file header above the first statement is not part of it.
const leadingComments = (editor: SourceEditor, statement: Span): E.Comment[] => {
  const previous = editor.program.body.findLast((node) => node.end <= statement.start);
  const from = previous ? statementEnd(editor, previous) : 0;
  const header = new Set(previous ? [] : headerComments(editor));
  return editor.comments.filter(
    (comment) => comment.start >= from && comment.end <= statement.start && !header.has(comment)
  );
};

/**
 * Insert a statement as the first statement after the directives, above the comments it owns. A file
 * header stays above it.
 */
export const prependStatement = (editor: SourceEditor, text: string) => {
  const { body } = editor.program;
  const directives = leadingDirectives(editor);
  const first = body[directives.length];
  if (!first) {
    const after =
      directives.at(-1)?.end ?? (editor.code.startsWith('#!') ? editor.code.indexOf('\n') + 1 : 0);
    editor.edits.appendLeft(after, `${after > 0 ? '\n' : ''}${text}\n`);
    return;
  }
  editor.edits.appendRight((leadingComments(editor, first)[0] ?? first).start, `${text}\n`);
};

export const appendStatement = (editor: SourceEditor, text: string) => {
  const last = editor.program.body.at(-1);
  if (!last) {
    editor.edits.append(
      `${editor.code.length > 0 && !editor.code.endsWith('\n') ? '\n' : ''}${text}\n`
    );
    return;
  }
  insertStatementAfter(editor, last, text);
};

/** Remove a statement with the comments it owns, and its lines when nothing else shares them. */
export const removeStatement = (editor: SourceEditor, statement: Span, atTop?: boolean) => {
  editor.assertCurrent(statement);
  const { code } = editor;
  const start = (leadingComments(editor, statement)[0] ?? statement).start;
  const end = statementEnd(editor, statement);
  const lineBreak = lineEnd(code, end);
  let from = lineStart(code, start);
  if (code.slice(end, lineBreak).trim()) {
    // Code stays after it on the line: take the spaces before that code.
    editor.edits.remove(start, end + /^[^\S\n]*/.exec(code.slice(end))![0].length);
    return;
  }
  if (code.slice(from, start).trim()) {
    // Code stays before it on the line: take the spaces after that code.
    editor.edits.remove(start - /[^\S\n]*$/.exec(code.slice(from, start))![0].length, end);
    return;
  }
  // The statement takes the blank lines above it, so none are left behind; at the top of the
  // file it takes the ones below instead.
  let to = Math.min(lineBreak + 1, code.length);
  if (atTop ?? from === 0) {
    to += /^\s*/.exec(code.slice(to))![0].length;
  } else {
    while (from > 0 && !code.slice(lineStart(code, from - 1), from).trim()) {
      from = lineStart(code, from - 1);
    }
  }
  editor.edits.remove(from, to);
};

/** Remove top-level statements, each with a `;` that directly follows it. */
export const removeStatements = (editor: SourceEditor, statements: ReadonlySet<Node>) => {
  statements.forEach((statement) => editor.assertCurrent(statement));
  const { body } = editor.program;
  let keptBefore = false;
  body.forEach((statement, index) => {
    const next = body[index + 1];
    if (!statements.has(statement)) {
      keptBefore = keptBefore || statement.type !== 'EmptyStatement';
      return;
    }
    const empty = next?.type === 'EmptyStatement' && next.start === statement.end;
    const span = empty ? { start: statement.start, end: next.end } : statement;
    // Nothing kept above: the statement takes the whitespace below it instead.
    removeStatement(editor, span, !keptBefore);
  });
};

/**
 * Rewrite an import's specifiers to `kept` plus `added`, keeping each kept specifier as written,
 * comments and layout included.
 */
export const setImportSpecifiers = (
  editor: SourceEditor,
  declaration: E.ImportDeclaration,
  kept: readonly E.ImportDeclaration['specifiers'][number][],
  added: { default?: string; named?: string[] } = {}
) => {
  editor.assertCurrent(declaration);
  const { specifiers } = declaration;
  const named = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
  const others = specifiers.filter((specifier) => specifier.type !== 'ImportSpecifier');
  const head = [
    ...(added.default ? [added.default] : []),
    ...others.filter((specifier) => kept.includes(specifier)).map((s) => editor.source(s)),
  ];
  const kind = declaration.importKind === 'type' ? 'import type' : 'import';
  const addedNamed = added.named ?? [];
  if (!named.some((specifier) => kept.includes(specifier))) {
    const parts = [...head, ...(addedNamed.length > 0 ? [`{ ${addedNamed.join(', ')} }`] : [])];
    editor.edits.overwrite(
      declaration.start,
      declaration.source.start,
      `${kind} ${parts.join(', ')} from `
    );
    return;
  }
  const list = specifierList(editor, declaration);
  const removed = named.filter((specifier) => !kept.includes(specifier));
  removeFromList(editor, list, removed);
  if (addedNamed.length > 0) {
    appendToList(editor, list, addedNamed);
  }
  if (added.default || others.some((specifier) => !kept.includes(specifier))) {
    editor.edits.overwrite(
      declaration.start,
      list.open - 1,
      `${kind} ${head.map((part) => `${part}, `).join('')}`
    );
  }
};

export const replaceValue = (editor: SourceEditor, member: Property, text: string) => {
  editor.assertCurrent(member);
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
  const value = outerSpan(member.value);
  editor.edits.overwrite(value.start, value.end, text);
};

export const keySource = (editor: SourceEditor, member: Property) =>
  editor.source(keyRange(editor, member));

// A computed key's span includes its brackets: the tokens around the key and its parentheses.
const keyRange = (editor: SourceEditor, member: Property): Span => {
  editor.assertCurrent(member);
  if (!member.computed) {
    return member.key;
  }
  const key = outerSpan(member.key);
  return {
    start: previousTokenEnd(editor, key.start) - 1,
    end: nextTokenStart(editor, key.end) + 1,
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
  const list = objectList(editor, object);
  const indent = lineIndent(editor.code, member.start);
  const dedent = (start: number, end: number) => dedentSource(editor, start, end, indent);
  return itemTextWith(editor, list, list.items.indexOf(member), (start) => {
    if (member.shorthand) {
      return `${dedent(start, member.start)}${key}: ${editor.source(member.value)}`;
    }
    const range = keyRange(editor, member);
    return `${dedent(start, range.start)}${key}${dedent(range.end, member.end)}`;
  });
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
