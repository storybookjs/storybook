import remapping, { type SourceMapInput } from '@jridgewell/remapping';
import MagicString, { SourceMap } from 'magic-string';

import {
  type E,
  type Node,
  type ParsedModule,
  type Property,
  isNode,
  isValidIdentifier,
  parseModule,
  registerSource,
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
    this._module = parseModule(code, fileName);
    // Every node prints as the text it was parsed from, wherever it is used.
    registerSource(this._module.program, code);
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
    this._module = parseModule(code, this.fileName);
    registerSource(this._module.program, code);
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
export const printMembers = (members: string[]) =>
  members.length === 0
    ? '{}'
    : `{\n${members.map((member) => `  ${reindent(member, '', '  ')},`).join('\n')}\n}`;

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

/** The `{ … }` of an import or export with at least one named specifier. */
export const specifierList = (
  editor: SourceEditor,
  declaration: E.ImportDeclaration | E.ExportNamedDeclaration
): List => {
  const items = declaration.specifiers.filter(
    (specifier) => specifier.type === 'ImportSpecifier' || specifier.type === 'ExportSpecifier'
  );
  return {
    open: editor.code.lastIndexOf('{', items[0].start) + 1,
    close: editor.code.indexOf('}', items.at(-1)!.end),
    items,
  };
};

export const objectList = (object: E.ObjectExpression | E.ObjectPattern): List => ({
  open: object.start + 1,
  close: object.end - 1,
  items: object.properties,
});

// Nodes are parsed without parentheses, so an element's span may sit inside `( )`. Leading holes
// (`[, a]`) stay in place: the list opens after their commas.
export const arrayList = (editor: SourceEditor, array: E.ArrayExpression): List => {
  const { code } = editor;
  let open = array.start + 1;
  for (const element of array.elements) {
    if (element) {
      break;
    }
    open = scanFor(code, open, array.end - 1, ',') ?? open;
  }
  return {
    open,
    close: array.end - 1,
    items: array.elements
      .filter((element): element is NonNullable<typeof element> => !!element)
      .map((element) => withParentheses(code, element, open, array.end - 1)),
  };
};

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

// Offsets of the line breaks in `text` that are part of a value: inside string and regex literals
// and template quasis. JSX text is not one: JSX trims its lines. Read from the parsed text, so no
// scanner has to know the grammar.
const valueLineBreaks = (text: string): Set<number> | undefined => {
  const parsed = parseLoosely(text);
  if (!parsed) {
    return undefined;
  }
  const breaks = new Set<number>();
  walk(parsed.program, (node) => {
    if (
      node.type === 'TemplateElement' ||
      (node.type === 'Literal' && (typeof node.value === 'string' || 'regex' in node))
    ) {
      const { start, end } = node as Node & { start: number; end: number };
      for (let index = start; index < end; index++) {
        if (text[index - parsed.offset] === '\n') {
          breaks.add(index - parsed.offset);
        }
      }
    }
  });
  return breaks;
};

// A fragment of source: statements, a `key: value` member (a labeled statement) or an expression.
const parseLoosely = (text: string): { program: E.Program; offset: number } | undefined => {
  try {
    return { program: parseModule(text).program, offset: 0 };
  } catch {
    try {
      return { program: parseModule(`(${text}\n)`).program, offset: 1 };
    } catch {
      return undefined;
    }
  }
};

// Fallback for text that is not parseable on its own, such as an import specifier: a scanner that
// tracks strings, templates, comments and regex literals.
const scannedValueLineBreaks = (text: string): Set<number> => {
  const breaks = new Set<number>();
  type Context = 'template' | { depth: number };
  const stack: Context[] = [{ depth: 0 }];
  let quote: string | undefined;
  let comment: 'line' | 'block' | undefined;
  let regex = false;
  let last = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const top = stack.at(-1)!;
    if (quote) {
      if (char === '\\') {
        if (text[index + 1] === '\n') {
          breaks.add(index + 1);
        }
        index++;
      } else if (char === quote || char === '\n') {
        quote = undefined;
      }
      continue;
    }
    if (regex) {
      if (char === '\\') {
        index++;
      } else if (char === '/' || char === '\n') {
        regex = false;
      }
      continue;
    }
    if (comment === 'line') {
      if (char === '\n') {
        comment = undefined;
      }
      continue;
    }
    if (comment === 'block') {
      if (text.startsWith('*/', index)) {
        comment = undefined;
        index++;
      }
      continue;
    }
    if (top === 'template') {
      if (char === '\\') {
        index++;
      } else if (char === '`') {
        stack.pop();
      } else if (text.startsWith('${', index)) {
        stack.push({ depth: 0 });
        index++;
      } else if (char === '\n') {
        breaks.add(index);
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '`') {
      stack.push('template');
    } else if (text.startsWith('//', index)) {
      comment = 'line';
    } else if (text.startsWith('/*', index)) {
      comment = 'block';
    } else if (char === '/' && /^$|[(,=:[!&|?{};+\-*%<>~^]/.test(last)) {
      regex = true;
    } else if (char === '{') {
      top.depth++;
    } else if (char === '}') {
      if (top.depth === 0 && stack.length > 1) {
        stack.pop();
      } else {
        top.depth--;
      }
    }
    if (!/\s/.test(char)) {
      last = char;
    }
  }
  return breaks;
};

/** Re-indent the continuation lines of `text`, leaving string and template literal values alone. */
export const reindent = (text: string, from: string, to: string) => {
  if (from === to || !text.includes('\n')) {
    return text;
  }
  const values = valueLineBreaks(text) ?? scannedValueLineBreaks(text);
  let result = '';
  let cursor = 0;
  for (
    let lineBreak = text.indexOf('\n');
    lineBreak !== -1;
    lineBreak = text.indexOf('\n', cursor)
  ) {
    result += text.slice(cursor, lineBreak + 1);
    cursor = lineBreak + 1;
    if (!values.has(lineBreak) && text.startsWith(from, cursor)) {
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

/** Replace contiguous members with `key: { …members }`, keeping the first member's comments. */
export const groupMembers = (
  editor: SourceEditor,
  object: E.ObjectExpression,
  members: Property[],
  key: string
) => {
  const texts = members.map((member) => memberText(editor, object, member));
  const first = object.properties.indexOf(members[0]);
  const multiline = editor.code.slice(object.start, object.end).includes('\n');
  removeMembers(editor, object, members.slice(1));
  const before = editor.code.slice(0, members[0].start);
  const indent = /[ \t]*$/.exec(before.slice(before.lastIndexOf('\n') + 1))![0];
  const inner = multiline ? reindent(printMembers(texts), '', indent) : `{ ${texts.join(', ')} }`;
  // Leading comments of the first member move into the group with it.
  const start = separatorBefore(editor.code, object, first);
  const lead = multiline ? `\n${indent}` : ' ';
  editor.edits.overwrite(start, members[0].end, `${lead}${printKey(key, editor.quote)}: ${inner}`);
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

/**
 * Remove a statement with the comments that lead it and the comment that trails it on its line,
 * and the line itself when nothing else shares it.
 */
export const removeStatement = (editor: SourceEditor, statement: Span, atTop?: boolean) => {
  const { code } = editor;
  const first = leadingComments(editor, statement)[0];
  const start = (first ?? statement).start;
  const lineStart = code.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = code.indexOf('\n', statement.end);
  const trailing = editor.comments.find(
    (comment) =>
      comment.start >= statement.end &&
      (lineEnd === -1 || comment.start < lineEnd) &&
      !code.slice(statement.end, comment.start).trim()
  );
  const end =
    trailing && (lineEnd === -1 || trailing.end <= lineEnd) ? trailing.end : statement.end;
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
    while (from > 0 && /^[ \t]*\n$/.test(code.slice(code.lastIndexOf('\n', from - 2) + 1, from))) {
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
 * comments included.
 */
export const setImportSpecifiers = (
  editor: SourceEditor,
  declaration: E.ImportDeclaration,
  kept: readonly E.ImportDeclaration['specifiers'][number][],
  added: { default?: string; named?: string[] } = {}
) => {
  const { specifiers } = declaration;
  const named = specifiers.filter((specifier) => specifier.type === 'ImportSpecifier');
  const list = named.length ? specifierList(editor, declaration) : undefined;
  const namedTexts = [
    ...named.filter((specifier) => kept.includes(specifier)).map((s) => itemText(editor, list!, s)),
    ...(added.named ?? []),
  ];
  const parts = [
    ...(added.default ? [added.default] : []),
    ...specifiers
      .filter((specifier) => specifier.type !== 'ImportSpecifier' && kept.includes(specifier))
      .map((specifier) => editor.source(specifier)),
    ...(namedTexts.length > 0 ? [`{ ${namedTexts.join(', ')} }`] : []),
  ];
  const kind = declaration.importKind === 'type' ? 'import type' : 'import';
  editor.edits.overwrite(
    declaration.start,
    declaration.source.start,
    `${kind} ${parts.join(', ')} from `
  );
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

// Length of `export default` and the whitespace after it at `start`.
// Comments may sit between and after the keywords.
const SKIPPED = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*\n)`;
const EXPORT_DEFAULT = new RegExp(`^export${SKIPPED}+default${SKIPPED}*`);

export const exportDefaultKeywords = (code: string, start: number) =>
  EXPORT_DEFAULT.exec(code.slice(start))![0].length;

export const isSpan = (value: unknown): value is Span =>
  isNode(value) && typeof (value as unknown as Span).start === 'number';

export type { Node };
