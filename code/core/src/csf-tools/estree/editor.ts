import remapping, { type SourceMapInput } from '@jridgewell/remapping';
import MagicString, { SourceMap } from 'magic-string';

import {
  type E,
  type Node,
  type ParsedModule,
  type Property,
  isNode,
  isValidIdentifier,
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
 * byte-identical; `commit()` applies them and parses the result again.
 */
export class SourceEditor {
  _module: ParsedModule;

  _scopes: ScopeInfo | undefined;

  _parents: Map<Node, Node | null> | undefined;

  _edits: MagicString;

  // Maps of the edits applied by earlier commits, oldest first, so the output still maps to the
  // code the editor was created with.
  _committed: SourceMap[] = [];

  readonly fileName: string | undefined;

  constructor(code: string, fileName?: string) {
    this.fileName = fileName;
    this._module = parsePrintable(code, fileName);
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
    return sourceOf(this.code, node);
  }

  /** Apply pending edits and parse the result again. Returns whether anything changed. */
  commit() {
    if (!this.pending) {
      return false;
    }
    this._committed.push(
      this._edits.generateMap({ hires: true, includeContent: true, source: mapSource(this) })
    );
    this.replaceSource(this._edits.toString());
    return true;
  }

  replaceSource(code: string) {
    this._module = parsePrintable(code, this.fileName);
    this._scopes = undefined;
    this._parents = undefined;
    this._edits = new MagicString(code, { filename: this.fileName });
  }

  /**
   * Hi-res map from the code the editor was created with to `toString()`, through every commit,
   * and through `inputSourceMap` when the code came from an earlier transform.
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
      sourcesContent: composed.sourcesContent as string[] | undefined,
      names: composed.names,
      // Encoded, since `decodedMappings` was not requested.
      mappings: composed.mappings as string,
    }) as GeneratedMap;
    if (input?.sourceRoot) {
      map.sourceRoot = input.sourceRoot;
    }
    return map;
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

const nextTokenStart = (code: string, comments: readonly Span[], index: number) => {
  let next = index;
  while (next < code.length) {
    const comment = comments.find((candidate) => candidate.start === next);
    if (comment) {
      next = comment.end;
    } else if (/\s/.test(code[next])) {
      next++;
    } else {
      break;
    }
  }
  return next;
};

const previousTokenEnd = (code: string, comments: readonly Span[], index: number) => {
  let previous = index;
  while (previous > 0) {
    const comment = comments.find((candidate) => candidate.end === previous);
    if (comment) {
      previous = comment.start;
    } else if (/\s/.test(code[previous - 1])) {
      previous--;
    } else {
      break;
    }
  }
  return previous;
};

/** The `{ … }` of an import or export with at least one named specifier. */
export const specifierList = (
  editor: SourceEditor,
  declaration: E.ImportDeclaration | E.ExportNamedDeclaration
): List => {
  const { code, comments } = editor;
  const items = declaration.specifiers.filter(
    (specifier) => specifier.type === 'ImportSpecifier' || specifier.type === 'ExportSpecifier'
  );
  const afterLast = nextTokenStart(code, comments, items.at(-1)!.end);
  return {
    open: previousTokenEnd(code, comments, items[0].start),
    close: code[afterLast] === ',' ? nextTokenStart(code, comments, afterLast + 1) : afterLast,
    items,
  };
};

export const objectList = (object: E.ObjectExpression | E.ObjectPattern): List => ({
  open: object.start + 1,
  close: object.end - 1,
  items: object.properties,
});

// A hole (`[a, , b]`) is an empty item right before the comma that writes it.
const isHole = (item: Span) => item.start === item.end;

// An element's item spans the parentheses around it.
export const arrayList = (editor: SourceEditor, array: E.ArrayExpression): List => {
  const { code, comments } = editor;
  const open = array.start + 1;
  const close = array.end - 1;
  let cursor = open;
  const items = array.elements.map((element): Span => {
    let item: Span;
    if (element) {
      item = outerSpan(element);
    } else {
      const comma = nextTokenStart(code, comments, cursor);
      item = { start: comma, end: comma };
    }
    const next = nextTokenStart(code, comments, item.end);
    cursor = code[next] === ',' ? next + 1 : next;
    return item;
  });
  return { open, close, items };
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
 * Re-indent the continuation lines of `text`, leaving string and template literal values alone.
 * Text that does not parse is returned unchanged, as its literals cannot be located.
 */
export const reindent = (text: string, from: string, to: string) => {
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

// The comment after `index` on its line, when nothing else follows it there.
const trailingComment = (editor: SourceEditor, index: number) => {
  const { code } = editor;
  const lineBreak = code.indexOf('\n', index);
  const lineEnd = lineBreak === -1 ? code.length : lineBreak;
  const comment = editor.comments.find(
    (candidate) => candidate.start >= index && candidate.end <= lineEnd
  );
  const alone =
    comment && !code.slice(index, comment.start).trim() && !code.slice(comment.end, lineEnd).trim();
  return alone ? comment : undefined;
};

// End of an item with its separator and the comment that trails them on their line.
const itemEnd = (editor: SourceEditor, list: List, index: number) => {
  const end = separatorAfter(editor.code, list, index) ?? list.items[index].end;
  return trailingComment(editor, end)?.end ?? end;
};

// Start of what an item owns: after the separator before it and the comment trailing that.
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
  const end = separatorAfter(code, list, index) ?? item.end;
  const comment = trailingComment(editor, end);
  return comment ? `${editor.source(comment)}\n${text}` : text;
};

/**
 * Text of an item including the comments that lead it, with continuation lines dedented. A
 * comment that trails the item on its line moves above it, so a comma can follow the text.
 */
export const itemText = (editor: SourceEditor, list: List, item: Span) =>
  itemTextWith(editor, list, list.items.indexOf(item), (start) =>
    dedentSource(editor, start, item.end, lineIndent(editor.code, item.start))
  );

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
  const comma = separatorAfter(code, list, items.length - 1);
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
  const lastKept = items.findLastIndex((item) => !removed.has(item));
  items.forEach((item, index) => {
    if (!removed.has(item)) {
      return;
    }
    if (index > lastKept && separatorAfter(code, list, index) === undefined) {
      // Trailing item without a comma: drop the comma of the last kept item instead, unless that
      // comma writes a hole.
      const previous = items[lastKept];
      if (!isHole(previous)) {
        edits.remove(previous.end, separatorAfter(code, list, lastKept)!);
      }
    }
    edits.remove(itemStart(editor, list, index), itemEnd(editor, list, index));
  });
};

export const appendMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  appendToList(editor, objectList(object), texts);

export const prependMembers = (editor: SourceEditor, object: E.ObjectExpression, texts: string[]) =>
  prependToList(editor, objectList(object), texts);

/** Replace contiguous members with `key: { …members }`, keeping the first member's comments. */
export const groupMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: Property[],
  key: string
) => {
  const list = objectList(object);
  const texts = members.map((member) => memberText(editor, object, member));
  const first = list.items.indexOf(members[0]);
  const multiline = editor.code.slice(object.start, object.end).includes('\n');
  removeMembers(editor, object, members.slice(1));
  const before = editor.code.slice(0, members[0].start);
  const indent = /[ \t]*$/.exec(before.slice(before.lastIndexOf('\n') + 1))![0];
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
  const comma = separatorAfter(editor.code, list, first) ?? members[0].end;
  if (itemEnd(editor, list, first) > comma) {
    editor.edits.remove(comma, itemEnd(editor, list, first));
  }
};

export const removeMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: readonly E.ObjectPropertyKind[]
) => removeFromList(editor, objectList(object), members);

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

/**
 * Remove a statement with the comments that lead it and the comment that trails it on its line,
 * and the line itself when nothing else shares it.
 */
/** The end of a statement, past a comment that trails it on the same line. */
export const statementEnd = (editor: SourceEditor, statement: Span) => {
  const { code } = editor;
  const lineEnd = code.indexOf('\n', statement.end);
  const trailing = editor.comments.find(
    (comment) =>
      comment.start >= statement.end &&
      (lineEnd === -1 || comment.start < lineEnd) &&
      !code.slice(statement.end, comment.start).trim()
  );
  return trailing && (lineEnd === -1 || trailing.end <= lineEnd) ? trailing.end : statement.end;
};

export const removeStatement = (editor: SourceEditor, statement: Span, atTop?: boolean) => {
  const { code } = editor;
  const first = leadingComments(editor, statement)[0];
  const start = (first ?? statement).start;
  const lineStart = code.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = code.indexOf('\n', statement.end);
  const end = statementEnd(editor, statement);
  const before = code.slice(lineStart, start);
  const after = code.slice(end, lineEnd === -1 ? code.length : lineEnd);
  if (before.trim() || after.trim()) {
    editor.edits.remove(start, end);
    return;
  }
  // The statement takes the blank lines above it, so none are left behind; at the top of the
  // file it takes the ones below instead.
  const top = atTop ?? lineStart === 0;
  let from = lineStart;
  let to = lineEnd === -1 ? code.length : lineEnd + 1;
  if (top) {
    to += /^\s*/.exec(code.slice(to))![0].length;
  } else {
    while (
      from > 0 &&
      /^[ \t]*\r?\n$/.test(code.slice(code.lastIndexOf('\n', from - 2) + 1, from))
    ) {
      from = code.lastIndexOf('\n', from - 2) + 1;
    }
  }
  editor.edits.remove(from, to);
};

/** Remove top-level statements, each with a `;` that directly follows it. */
export const removeStatements = (editor: SourceEditor, statements: ReadonlySet<Node>) => {
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
  if (!member.computed) {
    return member.key;
  }
  const { code, comments } = editor;
  const key = outerSpan(member.key);
  return {
    start: previousTokenEnd(code, comments, key.start) - 1,
    end: nextTokenStart(code, comments, key.end) + 1,
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
