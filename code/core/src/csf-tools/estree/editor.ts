import remapping, { type SourceMapInput } from '@jridgewell/remapping';
import MagicString, { SourceMap } from 'magic-string';

import {
  type E,
  type Node,
  type ParsedModule,
  type Property,
  type Span,
  isNode,
  isStringLiteral,
  isValidIdentifier,
  derivedFrom,
  moduleOf,
  normalizeLineEndings,
  outerSpan,
  parseModule,
  parsePrintable,
  placeableTextOf,
  restoreLineEndings,
  sourceOf,
  walk,
} from './ast.ts';
import { type ScopeInfo, analyzeScopes } from './scope.ts';

// Maps in a chain are matched by source name, so every map of an editor uses the same one. A
// private member would make the class nominal and break assignability between `src` and `dist`.
const mapSource = (editor: { fileName: string | undefined }) => editor.fileName ?? 'source';

/** A map whose `sourcesContent` may be unknown for sources an input map did not carry. */
export interface GeneratedMap {
  version: number;
  file: string | undefined;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
  sourceRoot?: string;
  /** The map as JSON. */
  toString(): string;
  /** The map as a data URI. */
  toUrl(): string;
}

/** The pending edits of a `SourceEditor`, addressed by offsets into its `code`. */
export interface SourceEdits {
  append(content: string): this;
  appendLeft(index: number, content: string): this;
  appendRight(index: number, content: string): this;
  prependRight(index: number, content: string): this;
  overwrite(start: number, end: number, content: string): this;
  /** Like `overwrite`, but keeps what was written next to the span. */
  update(start: number, end: number, content: string): this;
  remove(start: number, end: number): this;
  clone(): SourceEdits;
  /** The content of a span as edited so far; throws when an edit cuts through its ends. */
  slice(start: number, end: number): string;
  hasChanged(): boolean;
  generateMap(options?: {
    hires?: boolean | 'boundary';
    includeContent?: boolean;
    source?: string;
    file?: string;
  }): GeneratedMap;
  toString(): string;
}

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
 * Source text plus its OXC AST. Edits accumulate in `edits`, so untouched code stays as written;
 * `commit()` applies them, parses the result again and calls `onCommit`, so whoever derived state
 * from the old tree derives it again. Nodes and lists of an earlier parse index code that is gone:
 * `source()` and the editing functions throw for them. Line endings are normalized to `\n`, so
 * `code`, node offsets and `edits` use `\n`; `toString()` ends every line like the first, inserted
 * text too.
 */
export class SourceEditor {
  // The underscored members are not API, and none is `private`: a private member would make the
  // class nominal and break assignability between `src` and `dist`.
  _module: ParsedModule;

  _scopes: ScopeInfo | undefined;

  _parents: Map<Node, Node | null> | undefined;

  // The pending edits, with what they wrote that later edits of the same batch build on.
  _batch: Batch;

  // The edits each earlier commit applied, oldest first. Their maps are only generated when one
  // is requested, so the output still maps to the code the editor was created with.
  _committed: SourceEdits[] = [];

  // The code the editor was created with, line endings included: the content its maps name.
  readonly _originalCode: string;

  readonly fileName: string | undefined;

  readonly _onCommit: (() => void) | undefined;

  _style: Style | undefined;

  // The transaction running, if any: whether a mutation in it was refused, so it rolls back, and
  // how to undo state kept outside the editor, such as a `changed` flag.
  _transaction: { refused: boolean; rollbacks: (() => void)[] } | undefined;

  // Marks a mutation as refused, so the transaction it runs in rolls back.
  _refuse() {
    if (this._transaction) {
      this._transaction.refused = true;
    }
  }

  // Undoes state kept outside the editor when the transaction running, if any, rolls back.
  _onRollback(rollback: () => void) {
    this._transaction?.rollbacks.push(rollback);
  }

  // What `appendStatement` wrote without a blank line before it: statements of this parse, and
  // texts of pending edits. Each commit finds them in the code it parses, and sets one apart once
  // it or the statement before it spans lines.
  _appendedWithoutBlankLine: (Node | string)[] = [];

  constructor(code: string, fileName?: string, onCommit?: () => void) {
    this.fileName = fileName;
    this._onCommit = onCommit;
    this._originalCode = code;
    this._module = parsePrintable(code, fileName);
    this._batch = newBatch(this.code, fileName);
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
    return this._batch.edits;
  }

  get pending() {
    return this.edits.hasChanged();
  }

  source(node: Span) {
    this.assertCurrent(node);
    return sourceOf(this.code, node);
  }

  /**
   * Throw for a node or list of another parse, such as one from before a commit, and for a node
   * of no parse at all, such as a copy, which would pass for a current one otherwise.
   */
  assertCurrent(value: object) {
    const module = moduleOf(value);
    if (module === this._module) {
      return;
    }
    const what = 'type' in value ? `${value.type} node` : 'list';
    if (module) {
      throw new Error(
        `Cannot edit a ${what} of another parse: stale after \`commit()\`, or from \`parseExpression\`/\`get()\`; use \`textOf\` for those`
      );
    }
    if ('type' in value) {
      throw new Error(
        `Cannot edit a ${what} of no parse: a copy, or built by hand; pass a node of the editor's program`
      );
    }
  }

  /**
   * Apply pending edits and parse the result again. Returns whether anything changed. A result
   * that does not parse throws and leaves the editor as it was, the edits still pending.
   */
  commit() {
    if (!this.pending) {
      return false;
    }
    let module = parsePrintable(this.edits.toString(), this.fileName);
    this._style ??= inferStyle(this._module);
    this._committed.push(this.edits);
    let appended = this._appendedWithoutBlankLine
      .map((statement) => committedStatement(this.edits, module, statement))
      .filter((statement) => statement !== undefined);
    // The blank lines go in as edits of their own, over the code just parsed.
    const apart = appended.filter((statement) => setsApart(module, statement));
    if (apart.length > 0) {
      const spacing = new MagicString(module.code, { filename: this.fileName });
      for (const statement of apart) {
        spacing.appendLeft(ownLineStart(module, statement), '\n');
      }
      module = parsePrintable(spacing.toString(), this.fileName);
      this._committed.push(spacing);
      appended = appended
        .filter((statement) => !apart.includes(statement))
        .map((statement) => committedStatement(spacing, module, statement))
        .filter((statement) => statement !== undefined);
    }
    this._appendedWithoutBlankLine = appended;
    this._module = module;
    this._scopes = undefined;
    this._parents = undefined;
    this._batch = newBatch(this.code, this.fileName);
    this._onCommit?.();
    return true;
  }

  /**
   * Run `fn`, keeping its edits only when it does not throw, does not return `false` and no
   * mutation in it was refused. Otherwise the code, the tree and the pending and committed edits
   * are put back as they were, indexed again as a commit would when `fn` committed, and
   * `onRollback` runs. Returns whether they were kept.
   */
  transaction(fn: () => boolean | void, onRollback?: () => void): boolean {
    const { _module, _style, _transaction: outer } = this;
    const committed = this._committed.length;
    const batch = copyBatch(this._batch);
    const appended = [...this._appendedWithoutBlankLine];
    const transaction = { refused: false, rollbacks: onRollback ? [onRollback] : [] };
    this._transaction = transaction;
    let kept = false;
    try {
      const result: unknown = fn();
      if (typeof (result as PromiseLike<unknown> | undefined)?.then === 'function') {
        throw new Error(
          'A transaction cannot wait for a promise: its edits would be made after it'
        );
      }
      kept = result !== false && !transaction.refused;
    } finally {
      this._transaction = outer;
      if (kept) {
        outer?.rollbacks.push(...transaction.rollbacks);
      } else {
        transaction.rollbacks.reverse().forEach((rollback) => rollback());
        this._batch = batch;
        this._appendedWithoutBlankLine = appended;
        if (this._module !== _module) {
          this._module = _module;
          this._style = _style;
          this._committed.length = committed;
          this._scopes = undefined;
          this._parents = undefined;
          try {
            this._onCommit?.();
          } catch {
            // The code before `fn` indexed, or failed to, the same way.
          }
        }
      }
    }
    return kept;
  }

  /**
   * Hi-res map from the code the editor was created with to `toString()`, through every commit,
   * and through `inputSourceMap` when the code came from an earlier transform. Without an input
   * map, `sourcesContent` is that code as it was passed in, line endings included.
   */
  generateMap(options: { source?: string; inputSourceMap?: InputSourceMap } = {}): GeneratedMap {
    const source = options.source ?? this.fileName ?? '';
    const chain = [this.edits, ...this._committed.slice().reverse()].map((edits) =>
      edits.generateMap({ hires: true, includeContent: true, source: mapSource(this) })
    );
    const [current] = chain;
    const input =
      typeof options.inputSourceMap === 'string'
        ? (JSON.parse(options.inputSourceMap) as Exclude<InputSourceMap, string>)
        : options.inputSourceMap;
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
    return restoreLineEndings(this.edits.toString(), this._originalCode);
  }

  /** Quote for generated strings: the one most string literals of the file use. */
  get quote() {
    this._style ??= inferStyle(this._module);
    return this._style.quote;
  }

  /** Indent step for generated lines: the one of the file's first multi-line block. */
  get indent() {
    this._style ??= inferStyle(this._module);
    return this._style.indent;
  }

  /** Whether generated statements end with `;`, as they do unless most of the file's omit it. */
  get semicolons() {
    this._style ??= inferStyle(this._module);
    return this._style.semicolons;
  }
}

type Style = { quote: "'" | '"'; indent: string; semicolons: boolean };

interface Batch {
  edits: SourceEdits;
  // What the appends to each list wrote, by the list's span.
  lists: Map<string, Appended>;
  // The text inserted last after each statement.
  lastInsertedAfter: Map<Span, string>;
  // The line starts statements were inserted at, which a removal around them keeps. One can be
  // where code sharing a line starts, which the inserted statements moved to a line of its own.
  insertedAt: Set<number>;
}

const newBatch = (code: string, fileName: string | undefined): Batch => ({
  edits: new MagicString(code, { filename: fileName }),
  lists: new Map(),
  lastInsertedAfter: new Map(),
  insertedAt: new Set(),
});

const copyBatch = ({ edits, lists, lastInsertedAfter, insertedAt }: Batch): Batch => ({
  edits: edits.clone(),
  lists: new Map(lists),
  lastInsertedAfter: new Map(lastInsertedAfter),
  insertedAt: new Set(insertedAt),
});

// Statements and class fields that end with an optional `;`. A declaration in a `for` head has
// none; an exported declaration ends with the `;` of its `export`.
const endsWithOptionalSemicolon = (node: Node, parent: Node | null) => {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExpressionStatement':
    case 'ReturnStatement':
    case 'ThrowStatement':
    case 'TSTypeAliasDeclaration':
    case 'PropertyDefinition':
      return true;
    case 'ExportNamedDeclaration':
      return !node.declaration;
    case 'ExportDefaultDeclaration':
      return !/Declaration$/.test(node.declaration.type);
    case 'VariableDeclaration':
      return !parent?.type.startsWith('For');
    default:
      return false;
  }
};

// The style of the code the editor was created with, so edits do not change it. A tie between
// quotes goes to the first literal; JSX attributes are left out, as they keep double quotes.
const inferStyle = ({ code, program }: ParsedModule): Style => {
  const counts = { "'": 0, '"': 0 };
  const endings = { with: 0, without: 0 };
  let first: "'" | '"' | undefined;
  let indent: string | undefined;
  walk(program, (node, parent) => {
    if (endsWithOptionalSemicolon(node, parent)) {
      endings[code[node.end - 1] === ';' ? 'with' : 'without']++;
    }
    if (isStringLiteral(node) && parent?.type !== 'JSXAttribute') {
      const quote = node.raw?.[0];
      if (quote === "'" || quote === '"') {
        counts[quote]++;
        first ??= quote;
      }
    }
    indent ??= blockIndent(code, node);
  });
  const quote =
    counts["'"] === counts['"'] ? (first ?? '"') : counts["'"] > counts['"'] ? "'" : '"';
  return { quote, indent: indent ?? '  ', semicolons: endings.without <= endings.with };
};

// The indent step from a block's line to the line of its first item, if that is a deeper one.
const blockIndent = (code: string, node: Node) => {
  const first =
    node.type === 'ObjectExpression'
      ? node.properties[0]
      : node.type === 'ArrayExpression'
        ? node.elements[0]
        : node.type === 'BlockStatement'
          ? node.body[0]
          : undefined;
  if (!first || !code.slice(node.start, first.start).includes('\n')) {
    return undefined;
  }
  const outer = lineIndent(code, node.start);
  const inner = lineIndent(code, first.start);
  return inner.length > outer.length && inner.startsWith(outer)
    ? inner.slice(outer.length)
    : undefined;
};

export const printKey = (name: string, quote: string) =>
  isValidIdentifier(name, false) ? name : printString(name, quote);

export const printMemberAccess = (key: string, quote: string, optional = false) =>
  isValidIdentifier(key, false)
    ? `${optional ? '?.' : '.'}${key}`
    : `${optional ? '?.' : ''}[${printString(key, quote)}]`;

export const printString = (value: string, quote: string) => {
  const json = JSON.stringify(value);
  return quote === '"'
    ? json
    : `'${json.slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`;
};

const printLines = (items: string[], indent: string, open: string, close: string) =>
  items.length === 0
    ? `${open}${close}`
    : `${open}\n${items.map((item) => `${indent}${withComma(reindent(item, '', indent), ',', true)}`).join('\n')}\n${close}`;

/** An object literal laid out one member per line, so formatters keep it expanded. */
export const printMembers = (members: string[], indent: string) =>
  printLines(members, indent, '{', '}');

// Objects, or with `multiline` only objects and arrays with an item that spans lines, are laid out
// one item per line.
type ValueLayout = { indent: string; expand: 'objects' | 'multiline' };

const spansLines = (texts: string[]) => texts.some((text) => text.includes('\n'));

// A JS value as source, and a node of `get`, `parseExpression` or a file in it as `detachedTextOf`.
export const printValue = (value: unknown, quote: string, layout?: ValueLayout): string => {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'function') {
    return value.toString();
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
  if (isNode(value) && moduleOf(value)) {
    return detachedTextOf(value);
  }
  if (value instanceof RegExp) {
    return value.toString();
  }
  if (Array.isArray(value)) {
    const items = Array.from(value, (item) => printValue(item, quote, layout));
    return layout?.expand === 'multiline' && spansLines(items)
      ? printLines(items, layout.indent, '[', ']')
      : `[${items.join(', ')}]`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => `${printKey(key, quote)}: ${printValue(item, quote, layout)}`
    );
    if (layout && (layout.expand === 'objects' || spansLines(members))) {
      return printMembers(members, layout.indent);
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
 * A comma-separated list in the source: object members, array elements, call arguments, import
 * specifiers. `open` is the index right after the opening token, `close` the index of the closing
 * token, and `padding` the space inside them when the list is on one line: `{ a }` but `[a]`.
 */
export interface List {
  open: number;
  close: number;
  items: readonly Span[];
  padding: string;
}

// A list indexes the code of the parse it was read from, so it goes stale with its nodes.
const listOf = (editor: SourceEditor, list: List) => derivedFrom(list, editor._module);

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
  return listOf(editor, {
    open: previousTokenEnd(editor, items[0].start),
    close: code[afterLast] === ',' ? nextTokenStart(editor, afterLast + 1) : afterLast,
    items,
    padding: ' ',
  });
};

export const objectList = (
  editor: SourceEditor,
  object: E.ObjectExpression | E.ObjectPattern
): List => {
  editor.assertCurrent(object);
  return listOf(editor, {
    open: object.start + 1,
    close: object.end - 1,
    items: object.properties,
    padding: ' ',
  });
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
  return listOf(editor, { open, close, items, padding: '' });
};

// An argument's item spans the parentheses around it.
export const argumentList = (editor: SourceEditor, call: E.CallExpression): List => {
  editor.assertCurrent(call);
  let open = nextTokenStart(editor, (call.typeArguments ?? outerSpan(call.callee)).end);
  if (call.optional && !call.typeArguments) {
    open = nextTokenStart(editor, open + '?.'.length);
  }
  const items = call.arguments.map(outerSpan);
  return listOf(editor, { open: open + 1, close: call.end - 1, items, padding: '' });
};

/** The declarators of a declaration, from its keyword to its last declarator. */
export const declaratorList = (editor: SourceEditor, declaration: E.VariableDeclaration): List => {
  editor.assertCurrent(declaration);
  return listOf(editor, {
    open: previousTokenEnd(editor, declaration.declarations[0].start),
    close: declaration.declarations.at(-1)!.end,
    items: declaration.declarations,
    padding: ' ',
  });
};

// Position right after the comma that follows an item, if it has one.
const separatorAfter = (editor: SourceEditor, item: Span) => {
  const next = nextTokenStart(editor, item.end);
  return editor.code[next] === ',' ? next + 1 : undefined;
};

/** Leading whitespace of the line that `index` is on. */
export const lineIndent = (code: string, index: number) =>
  /^[ \t]*/.exec(code.slice(lineStart(code, index)))![0];

const isMultiline = (code: string, list: List) => code.slice(list.open, list.close).includes('\n');

// Spans of the literals under `root` whose line breaks are part of their value: strings, regexes
// and template quasis, but not JSX text, which JSX trims. Relative to `range.start`.
const literalSpans = (root: Node, range: Span): Span[] => {
  const spans: Span[] = [];
  walk(root, (node) => {
    const { start, end } = node;
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

// The parse of a text as one of the fragments, with the offset of the text in it.
const parsedFragment = (text: string) => {
  for (const [before, after] of FRAGMENTS) {
    try {
      return { ...parseModule(`${before}${text}${after}`), offset: before.length };
    } catch {
      continue;
    }
  }
  return undefined;
};

const parsedLiteralSpans = (text: string): Span[] | undefined => {
  const fragment = parsedFragment(text);
  return (
    fragment &&
    literalSpans(fragment.program, { start: fragment.offset, end: fragment.offset + text.length })
  );
};

const lineBreakAt = (code: string, index: number) => index === code.length || code[index] === '\n';

// `text` without the whitespace ending it, and where the line comment that ends it starts, if one
// does. A text that does not parse keeps its whitespace.
const trailingLineComment = (text: string): { body: string; at: number | undefined } => {
  const body = text.trimEnd();
  if (body === text) {
    return { body, at: undefined };
  }
  const fragment = parsedFragment(body);
  if (!fragment) {
    return { body: text, at: undefined };
  }
  const comment = fragment.comments.findLast(
    (candidate) => candidate.type === 'Line' && candidate.end === fragment.offset + body.length
  );
  return { body, at: comment && comment.start - fragment.offset };
};

const endsInLineComment = (text: string) => trailingLineComment(text).at !== undefined;

// `text` with `comma` after it. A text ending in a line comment, which `placeableTextOf` ends with
// a line break, takes the comma before the comment and keeps the line break, unless the code's own
// follows where the text goes.
const withComma = (text: string, comma: string, lineBreakFollows: boolean) => {
  const { body, at } = trailingLineComment(text);
  if (at === undefined) {
    return `${body}${comma}`;
  }
  return `${body.slice(0, at).trimEnd()}${comma} ${body.slice(at)}${lineBreakFollows ? '' : '\n'}`;
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

// The editor's code from `start` to `end`, its continuation lines without `indent`.
const dedentSource = (editor: SourceEditor, start: number, end: number, indent: string) => {
  const text = editor.code.slice(start, end);
  return indent === '' || !text.includes('\n')
    ? text
    : reindentLines(text, indent, '', literalSpans(editor.program, { start, end }));
};

// The source of a span of the editor's code as if the line it starts on had no indent.
export const detachedSource = (editor: SourceEditor, span: Span) => {
  editor.assertCurrent(span);
  return dedentSource(editor, span.start, span.end, lineIndent(editor.code, span.start));
};

/**
 * `placeableTextOf` dedented as if the node's line had no indent, to place a node of `get`,
 * `parseExpression` or a `SourceEditor` at another indent.
 */
export const detachedTextOf = (node: Node) =>
  reindent(placeableTextOf(node), lineIndent(moduleOf(node)!.code, node.start), '');

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

// `itemText` with the item itself printed by `print`. The comments that trailed the item on its
// line move above it, on a line of their own: below the comments leading it from earlier lines,
// above the ones sharing its line.
const itemTextWith = (editor: SourceEditor, list: List, index: number, print: () => string) => {
  const { code } = editor;
  const item = list.items[index];
  const from = itemStart(editor, list, index);
  const leadStart = from + /^\s*/.exec(code.slice(from, item.start))![0].length;
  const indent = lineIndent(code, item.start);
  const trailing = trailingComments(editor, separatorAfter(editor, item) ?? item.end);
  const moved =
    trailing.length > 0 ? `${code.slice(trailing[0].start, trailing.at(-1)!.end)}\n` : '';
  const onLine =
    triviaBefore(editor, item.start).comments.find(
      (comment) => comment.start >= leadStart && !code.slice(comment.end, item.start).includes('\n')
    )?.start ?? item.start;
  const above = dedentSource(editor, leadStart, onLine, indent);
  return `${above}${moved}${dedentSource(editor, onLine, item.start, indent)}${print()}`;
};

/**
 * Text of an item including the comments that lead it, with continuation lines dedented. The
 * comments that trail the item on its line move above it, so a comma can follow the text.
 */
export const itemText = (editor: SourceEditor, list: List, item: Span) => {
  editor.assertCurrent(list);
  editor.assertCurrent(item);
  return itemTextWith(editor, list, list.items.indexOf(item), () => detachedSource(editor, item));
};

export const memberText = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  member: E.ObjectPropertyKind
) => itemText(editor, objectList(editor, object), member);

// Items with their commas on the line of a one-line list, their continuation lines indented like
// it. A line comment ending an item takes the line break where a space would join the next.
const inline = (
  editor: SourceEditor,
  list: List,
  texts: string[],
  lastComma: string,
  lineBreakFollows: boolean
) => {
  const indent = lineIndent(editor.code, list.open);
  let joined = '';
  texts.forEach((text, index) => {
    const isLast = index === texts.length - 1;
    const item = withComma(
      reindent(text, '', indent),
      isLast ? lastComma : ',',
      isLast && lineBreakFollows
    );
    joined += `${joined === '' || joined.endsWith('\n') ? '' : ' '}${item}`;
  });
  return joined;
};

// What the appends of a batch of edits wrote to a list: where later items go, one per line at
// `indent` or on the list's line without one, the list's trailing comma, whether a line break
// follows, and what has to come before the next item. Items after an item are written to the right
// of its end, so a wrapper of that item stays around the item alone.
interface Appended {
  at: number;
  right: boolean;
  indent: string | undefined;
  trailingComma: string;
  lineBreakFollows: boolean;
  separator: string;
}

const insert = (edits: SourceEdits, { at, right }: Pick<Appended, 'at' | 'right'>, text: string) =>
  right ? edits.appendRight(at, text) : edits.appendLeft(at, text);

// Items one per line at `indent`, each after a line break.
const itemLines = (
  texts: string[],
  indent: string,
  trailingComma: string,
  lineBreakFollows: boolean
) =>
  texts
    .map((text, index) => {
      const isLast = index === texts.length - 1;
      return `\n${indent}${withComma(reindent(text, '', indent), isLast ? trailingComma : ',', !isLast || lineBreakFollows)}`;
    })
    .join('');

// A line comment ending the last item puts the comma for the next one on the next line.
const withSeparator = (
  layout: Omit<Appended, 'separator'>,
  written: string,
  lastItem: string
): Appended => ({
  ...layout,
  separator:
    layout.trailingComma === ','
      ? ''
      : endsInLineComment(lastItem)
        ? `${written.endsWith('\n') ? '' : '\n'}${layout.indent ?? ''},`
        : ',',
});

// Each item of a one-line list on a line of its own at `indent`, and its closing token on the next.
// The line breaks replace the spaces in place, so items written next to them keep their side.
const breakLines = (editor: SourceEditor, list: List, indent: string) => {
  const { code, edits } = editor;
  list.items.forEach((_, index) => {
    const from = itemStart(editor, list, index);
    const to = from + /^\s*/.exec(code.slice(from))![0].length;
    if (to > from) {
      edits.update(from, to, `\n${indent}`);
    } else {
      edits.appendRight(from, `\n${indent}`);
    }
  });
  const outer = `\n${lineIndent(code, list.open)}`;
  const end = list.close - /\s*$/.exec(code.slice(list.open, list.close))![0].length;
  if (end < list.close) {
    edits.update(end, list.close, outer);
  } else {
    // Without spaces before it, the closing token takes the line break, so it follows the items.
    edits.update(list.close, list.close + 1, `${outer}${code[list.close]}`);
  }
};

const appendFirst = (editor: SourceEditor, list: List, texts: string[]): Appended => {
  const { code, edits } = editor;
  const { items, padding } = list;
  const write = (layout: Omit<Appended, 'separator'>, text: string) => {
    insert(edits, layout, text);
    return withSeparator(layout, text, texts.at(-1)!);
  };
  // The text after the items goes to the right of the list's end, so later items go before it.
  const close = (text: string) => {
    if (text !== '') {
      edits.appendRight(list.close, text);
    }
  };
  if (items.length === 0) {
    // Only comments can be inside an empty list, and the items go after them.
    const inner = code.slice(list.open, list.close);
    const end = list.open + inner.trimEnd().length;
    if ((inner.includes('\n') && end > list.open) || texts.some((text) => text.includes('\n'))) {
      // Multi-line items, or comments on lines of their own: lay the items out one per line, lined
      // up with the last comment when that starts a line.
      const outer = lineIndent(code, list.open - 1);
      const last = commentAt(editor, end, 'end');
      const indent =
        last && lineStart(code, last.start) > list.open
          ? lineIndent(code, last.start)
          : `${outer}${editor.indent}`;
      if (list.close > end) {
        edits.remove(end, list.close);
      }
      close(`\n${outer}`);
      const layout = { at: end, right: false, indent, trailingComma: ',', lineBreakFollows: true };
      return write(layout, itemLines(texts, indent, ',', true));
    }
    const oneLine = { right: false, indent: undefined, trailingComma: '', lineBreakFollows: false };
    if (end > list.open) {
      if (end === list.close) {
        close(padding);
      }
      return write({ ...oneLine, at: end }, ` ${texts.join(', ')}`);
    }
    if (list.close > list.open) {
      edits.remove(list.open, list.close);
    }
    close(padding);
    return write({ ...oneLine, at: list.open }, `${padding}${texts.join(', ')}`);
  }
  const last = items.at(-1)!;
  const comma = separatorAfter(editor, last);
  // The comma of a hole writes the hole, so it is no trailing comma to keep.
  const trailingComma = comma === undefined || isHole(last) ? '' : ',';
  // A formatter puts the items of an object or array on lines of their own once one spans lines,
  // but keeps a last argument that does on the line of the call: `f(a, () => {…})`.
  const breaks =
    (code[list.open - 1] === '{' || code[list.open - 1] === '[') &&
    !isMultiline(code, list) &&
    texts.some((text) => text.includes('\n'));
  if (breaks || isMultiline(code, list)) {
    const indent = breaks
      ? `${lineIndent(code, list.open)}${editor.indent}`
      : lineIndent(code, last.start);
    if (breaks) {
      breakLines(editor, list, indent);
    }
    const at = itemEnd(editor, list, items.length - 1);
    if (comma === undefined) {
      edits.appendRight(last.end, ',');
    }
    const lineBreakFollows = breaks || lineBreakAt(code, at);
    return write(
      { at, right: true, indent, trailingComma, lineBreakFollows },
      itemLines(texts, indent, trailingComma, lineBreakFollows)
    );
  }
  const at = comma ?? last.end;
  const lineBreakFollows = lineBreakAt(code, at);
  const text = inline(editor, list, texts, trailingComma, lineBreakFollows);
  return write(
    { at, right: true, indent: undefined, trailingComma, lineBreakFollows },
    comma === undefined ? `, ${text}` : ` ${text}`
  );
};

const appendAfter = (editor: SourceEditor, list: List, previous: Appended, texts: string[]) => {
  const { indent, trailingComma, lineBreakFollows, separator } = previous;
  const text =
    indent === undefined
      ? ` ${inline(editor, list, texts, trailingComma, lineBreakFollows)}`
      : itemLines(texts, indent, trailingComma, lineBreakFollows);
  insert(editor.edits, previous, `${separator}${text}`);
  return withSeparator(previous, text, texts.at(-1)!);
};

/**
 * Append items to a list, after the items earlier appends of the same batch of edits added to it.
 * That writes what one append of all of them writes, except that a comma after an item ending in
 * a line comment goes on the next line, and items stay on the line of a list an earlier append
 * laid out so.
 */
export const appendToList = (editor: SourceEditor, list: List, texts: string[]) => {
  editor.assertCurrent(list);
  const { lists } = editor._batch;
  const key = `${list.open}:${list.close}`;
  const previous = lists.get(key);
  lists.set(
    key,
    previous ? appendAfter(editor, list, previous, texts) : appendFirst(editor, list, texts)
  );
};

export const prependToList = (editor: SourceEditor, list: List, texts: string[]) => {
  editor.assertCurrent(list);
  const { code, edits } = editor;
  const [first] = list.items;
  if (!first) {
    appendToList(editor, list, texts);
    return;
  }
  if (isMultiline(code, list)) {
    // Lined up with the first item that starts a line, as the first item may share the open token's.
    const lined = list.items.find(
      (item) => !code.slice(lineStart(code, item.start), item.start).trim()
    );
    const indent = lineIndent(code, (lined ?? first).start);
    const block = texts
      .map((text, index) => {
        const lineBreakFollows = index < texts.length - 1 || lineBreakAt(code, list.open);
        return `${indent}${withComma(reindent(text, '', indent), ',', lineBreakFollows)}`;
      })
      .join('\n');
    edits.appendLeft(list.open, `\n${block}`);
    return;
  }
  // To the left of the first item, so a wrapper of it stays around it alone.
  const items = inline(editor, list, texts, ',', false);
  edits.appendLeft(first.start, items.endsWith('\n') ? items : `${items} `);
};

/** Remove items with their separators and the comments that lead and trail them from a list. */
export const removeFromList = (editor: SourceEditor, list: List, removedItems: readonly Span[]) => {
  editor.assertCurrent(list);
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
    if (first === 0) {
      // No item before the run to keep the space after: what follows the run takes the space
      // before its first item instead, so `[a, b]` becomes `[b]`.
      const item = items[0].start;
      edits.remove(start, item - /\s*$/.exec(code.slice(start, item))![0].length);
      edits.remove(item, end + /^\s*/.exec(code.slice(end))![0].length);
    } else if (
      commentAt(editor, start, 'end')?.type === 'Line' &&
      code.slice(end, lineEnd(code, end)).trim()
    ) {
      // Code after the run on its line must not join the line of a line comment before it, so it
      // starts the next line, where the run's first item started or at the list's indent.
      const next = end + /^\s*/.exec(code.slice(end))![0].length;
      const indent = lineIndent(code, last === items.length - 1 ? list.open : items[first].start);
      edits.update(lineEnd(code, start) + 1, next, indent);
    } else {
      edits.remove(start, end);
    }
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
    ? reindent(printMembers(texts, editor.indent), '', indent)
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

// Whether a text ends its statement with `;`, before a line comment that ends it.
const endsStatement = (text: string) => {
  const { body, at } = trailingLineComment(`${text}\n`);
  return body.slice(0, at).trimEnd().endsWith(';');
};

/**
 * Insert a statement on its own line right after a statement and the comments it owns. What else
 * shares that line moves below the inserted statements.
 */
export const insertStatementAfter = (editor: SourceEditor, statement: Span, text: string) => {
  const { code, edits } = editor;
  const batch = editor._batch;
  // The new text follows the text inserted after the statement earlier in the batch, if any.
  const before = batch.lastInsertedAfter.get(statement) ?? editor.source(statement);
  batch.lastInsertedAfter.set(statement, text);
  const end = statementEnd(editor, statement);
  const next = end + /^[^\S\n]*/.exec(code.slice(end))![0].length;
  // The separator goes after the line breaks that lead the text.
  const lead = /^\s*/.exec(text)![0];
  const body = text.slice(lead.length);
  const separator = !endsStatement(before) && CONTINUES_STATEMENT.test(body) ? ';' : '';
  // A statement without `;` ends before code that would continue it, such as `[1].map(f)`.
  const terminator =
    !endsStatement(body) && CONTINUES_STATEMENT.test(code.slice(next).trimStart()) ? ';' : '';
  const line = `${lead}${separator}${body}${terminator}`;
  if (next === code.length) {
    edits.appendRight(next, `\n${line}`);
    return;
  }
  // At the start of the next line, or of the code sharing the statement's line, which a line break
  // moves to a line of its own: not at the statement's end, which can be its last expression's
  // end, where later text belongs to the expression, and left of the next statement, where text
  // belongs to that one. A removal of the statement keeps text there.
  const at = code[next] === '\n' ? next + 1 : next;
  if (at === next && !batch.insertedAt.has(at) && !isRemoved(editor, statement)) {
    pullUpSemicolon(editor, statement);
    if (next > end) {
      edits.overwrite(end, next, '\n');
    } else {
      edits.appendLeft(end, '\n');
    }
  }
  edits.appendLeft(at, `${line}\n`);
  batch.insertedAt.add(at);
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
 * header stays above it, as does everything in a file without statements.
 */
export const prependStatement = (editor: SourceEditor, text: string) => {
  const { body } = editor.program;
  const first = body[leadingDirectives(editor).length];
  if (!first) {
    appendStatement(editor, text);
    return;
  }
  const separator =
    !text.endsWith(';') && CONTINUES_STATEMENT.test(editor.code.slice(first.start)) ? ';' : '';
  editor.edits.appendRight(
    (leadingComments(editor, first)[0] ?? first).start,
    `${text}${separator}\n`
  );
};

// Whether pending edits removed a span; one cutting through either end of it counts as that.
const isRemoved = (editor: SourceEditor, span: Span) => {
  try {
    return editor.edits.slice(span.start, span.end) === '';
  } catch {
    return true;
  }
};

// Whether code is left between two offsets once the pending edits are made.
const keepsCode = (editor: SourceEditor, start: number, end: number) => {
  try {
    return editor.edits.slice(start, end).trim() !== '';
  } catch {
    return editor.code.slice(start, end).trim() !== '';
  }
};

// `remove`, split around the statements inserted inside the range, as removing a range clears what
// other edits wrote inside it.
const removeKeeping = (editor: SourceEditor, start: number, end: number) => {
  const inside = [...editor._batch.insertedAt]
    .filter((at) => start < at && at < end)
    .sort((a, b) => a - b);
  let from = start;
  for (const at of [...inside, end]) {
    editor.edits.remove(from, at);
    from = at;
  }
};

// Put the `;` that ends a statement at the start of a line back after the statement's code, before
// the comments between them, for when nothing else is left on that line: `a = 1 // c\n;` becomes
// `a = 1; // c`.
const pullUpSemicolon = (editor: SourceEditor, statement: Span) => {
  const { code, comments } = editor;
  const semicolon = statement.end - 1;
  if (
    code[semicolon] !== ';' ||
    statement.start === semicolon ||
    code.slice(lineStart(code, semicolon), semicolon).trim() ||
    statementEnd(editor, statement) !== statement.end ||
    isRemoved(editor, { start: semicolon, end: statement.end })
  ) {
    return;
  }
  const trimmedEnd = (index: number) =>
    statement.start + code.slice(statement.start, index).trimEnd().length;
  const inside = comments.filter((c) => c.start > statement.start && c.end <= semicolon);
  const contentEnd = trimmedEnd(semicolon);
  let codeEnd = contentEnd;
  while (inside.at(-1)?.end === codeEnd) {
    codeEnd = trimmedEnd(inside.pop()!.start);
  }
  editor.edits.remove(contentEnd, statement.end);
  editor.edits.appendRight(codeEnd, ';');
};

/**
 * Insert a statement after the last statement that pending edits did not remove. A blank line
 * sets it apart when it or what it follows spans lines: that statement, or the text appended after
 * it before.
 */
export const appendStatement = (editor: SourceEditor, text: string) => {
  const last = editor.program.body.findLast((statement) => !isRemoved(editor, statement));
  if (!last) {
    // A BOM is no content to end the line of.
    const output = editor.edits.toString().replace(/^\uFEFF/, '');
    editor.edits.append(`${output && !output.endsWith('\n') ? '\n' : ''}${text}\n`);
    return;
  }
  // The text inserted last may lead with the blank line that set it apart.
  const before = editor._batch.lastInsertedAfter.get(last)?.trim() ?? editor.source(last);
  const multiline = text.includes('\n') || before.includes('\n');
  if (!multiline) {
    editor._appendedWithoutBlankLine.push(text);
  }
  insertStatementAfter(editor, last, `${multiline ? '\n' : ''}${text}`);
};

// Where a statement, or a text appended as one, is in `module`, the code `edits` produced.
const committedStatement = (
  edits: SourceEdits,
  { code, program }: ParsedModule,
  statement: Node | string
) => {
  if (typeof statement === 'string') {
    return program.body.findLast((node) => sourceOf(code, node) === statement);
  }
  let start: number;
  try {
    if (edits.slice(statement.start, statement.end) === '') {
      return undefined;
    }
    start = normalizeLineEndings(edits.slice(0, statement.start)).length;
  } catch {
    // An edit cut through the statement.
    return undefined;
  }
  return program.body.find((node) => node.start === start);
};

type TopLevel = E.Program['body'][number];

const statementBefore = (program: E.Program, statement: TopLevel) => {
  const index = program.body.indexOf(statement);
  return index > 0 ? program.body[index - 1] : undefined;
};

// Whether a statement, or the statement before it, spans lines with no blank line between them.
const setsApart = ({ code, program }: ParsedModule, statement: TopLevel) => {
  const before = statementBefore(program, statement);
  return (
    !!before &&
    [before, statement].some((node) => sourceOf(code, node).includes('\n')) &&
    !/\n[^\S\n]*\n/.test(code.slice(before.end, statement.start))
  );
};

// The start of the first line of a statement with the comments above it, below the statement
// before it and the comments that share that statement's line.
const ownLineStart = ({ code, program, comments }: ParsedModule, statement: TopLevel) => {
  const before = statementBefore(program, statement)!;
  const above = comments.find(
    (comment) =>
      comment.start >= before.end &&
      comment.end <= statement.start &&
      code.slice(before.end, comment.start).includes('\n')
  );
  return lineStart(code, (above ?? statement).start);
};

/** The span of a statement with the comments it owns. */
export const statementSpan = (editor: SourceEditor, statement: Span): Span => ({
  start: (leadingComments(editor, statement)[0] ?? statement).start,
  end: statementEnd(editor, statement),
});

/** Remove a statement with the comments it owns, and its lines when nothing else shares them. */
export const removeStatement = (editor: SourceEditor, statement: Span, atTop?: boolean) => {
  const { code } = editor;
  const { start, end } = statementSpan(editor, statement);
  const lineBreak = lineEnd(code, end);
  // A statement inserted before the code sharing its line moved that code to a line of its own.
  let from = Math.max(
    lineStart(code, start),
    ...[...editor._batch.insertedAt].filter((at) => at <= start)
  );
  if (keepsCode(editor, end, lineBreak)) {
    // Code stays after it on the line: take the spaces before that code.
    editor.edits.remove(start, end + /^[^\S\n]*/.exec(code.slice(end))![0].length);
    return;
  }
  if (keepsCode(editor, from, start)) {
    // Code stays before it on the line: take the spaces after that code.
    editor.edits.remove(start - /[^\S\n]*$/.exec(code.slice(from, start))![0].length, end);
    const previous = editor.program.body.findLast(
      (node) => node.end <= start && !isRemoved(editor, node)
    );
    if (previous && !keepsCode(editor, previous.end, start)) {
      pullUpSemicolon(editor, previous);
    }
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
  removeKeeping(editor, from, to);
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
 * comments and layout included. A named specifier is its source text, such as `a` or `a as b`.
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

// The lines of `text` are indented like the line of the code it replaces.
export const replaceValue = (editor: SourceEditor, member: Property, text: string) => {
  editor.assertCurrent(member);
  const { code } = editor;
  const replacesMember = member.shorthand || member.method || member.kind !== 'init';
  const span: Span = replacesMember ? member : outerSpan(member.value);
  const indented = reindent(text, '', lineIndent(code, span.start));
  let replacement = indented;
  if (member.shorthand) {
    replacement = `${editor.source(member.key)}: ${indented}`;
  } else if (replacesMember) {
    replacement =
      methodFromFunction(indented, keySource(editor, member)) ??
      `${keySource(editor, member)}: ${indented}`;
  }
  // A text ending in a line comment takes the comma after the replaced code on its line before
  // the comment. The comma is removed as an edit of its own, so a removal of the next member can
  // still take it. Any other text leaves the comma to other edits.
  const { comments, end } = triviaAfter(editor, span.end, SPACE_ON_LINE);
  const comma = comments.length === 0 && code[end] === ',' ? end + 1 : undefined;
  const takesComma = comma !== undefined && endsInLineComment(replacement);
  const to = takesComma ? comma : span.end;
  editor.edits.overwrite(
    span.start,
    span.end,
    withComma(replacement, takesComma ? ',' : '', lineBreakAt(code, to))
  );
  if (takesComma) {
    if (end > span.end) {
      editor.edits.remove(span.end, end);
    }
    editor.edits.remove(end, comma);
  }
};

/**
 * Write `before` and `after` around an expression and the parentheses written around it. Text an
 * earlier edit wrote at its ends, such as `.input` after it, ends up inside, as does an earlier
 * wrapper; items list edits add next to it stay outside in either order.
 */
export const wrapExpression = (editor: SourceEditor, node: Node, before: string, after: string) => {
  editor.assertCurrent(node);
  const { start, end } = outerSpan(node);
  editor.edits.prependRight(start, before);
  editor.edits.appendLeft(end, after);
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
  return itemTextWith(editor, list, list.items.indexOf(member), () => {
    if (member.shorthand) {
      return `${key}: ${editor.source(member.value)}`;
    }
    const range = keyRange(editor, member);
    return `${dedent(member.start, range.start)}${key}${dedent(range.end, member.end)}`;
  });
};

// A method as the source of a function expression, as `detachedSource`, so reads and transforms
// of `play() {}` see a value. `async *play(a) {}` becomes `async function* (a) {}`.
export const functionFromMethod = (editor: SourceEditor, member: Property) => {
  const fn = member.value as E.Function;
  const range = keyRange(editor, member);
  const rest = dedentSource(editor, range.end, member.end, lineIndent(editor.code, member.start));
  return `${fn.async ? 'async ' : ''}function${fn.generator ? '*' : ''} ${rest.replace(/^\s*/, '')}`;
};

const methodFromFunction = (text: string, key: string) => {
  const match = /^(async\s+)?function\s*(\*)?\s*(?=[(<])/.exec(text);
  return match
    ? `${match[1] ? 'async ' : ''}${match[2] ? '*' : ''}${key}${text.slice(match[0].length)}`
    : undefined;
};

export type { Node };
