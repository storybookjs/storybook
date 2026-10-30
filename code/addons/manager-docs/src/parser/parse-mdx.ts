import { dirname, join, normalize } from 'pathe';

import { MANAGER_DOCS_MDX_SPECIFIER } from '../constants.ts';
import { parseFailure } from '../errors.ts';
import {
  STORY_PANEL_IDS,
  type Block,
  type ComponentProps,
  type CsfImport,
  type DocsPage,
  type Inline,
  type ListItem,
  type SourcePosition,
  type StoryFrameHeight,
  type StoryPanel,
  type TableAlign,
} from './types.ts';

type SourceLine = {
  text: string;
  line: number;
  column: number;
};

type DelimMarker = '*' | '_';

type InlineTok =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'image'; alt: string; url: string; title?: string }
  | { type: 'link'; url: string; title?: string; children: InlineTok[] }
  | { type: 'em'; children: InlineTok[] }
  | { type: 'strong'; children: InlineTok[] }
  | {
      type: 'delim';
      marker: DelimMarker;
      count: number;
      canOpen: boolean;
      canClose: boolean;
    };

type ComponentBinding = {
  source: string;
  exportName: string;
};

type BlockScope = {
  docsAlias: string | undefined;
  components: ReadonlyMap<string, ComponentBinding>;
  nested: boolean;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const CSF_SPECIFIER = /\.stories(?:\.[cm]?[jt]sx?)?$|\.story(?:\.[cm]?[jt]sx?)?$/;
const DOCS_BLOCKS_SPECIFIER = /^@storybook\/(?:addon-docs|blocks)(?:\/|$)/;

/**
 * Identify a component block by the module and export it renders, independent of the docs file.
 *
 * Relative sources resolve against the docs file, so two pages importing the same component share
 * one id.
 */
export function componentBlockId(docsFile: string, source: string, exportName: string): string {
  const module = source.startsWith('.')
    ? `./${normalize(join(dirname(docsFile), source))}`
    : source;
  return `${module}#${exportName}`;
}

/**
 * Parse a hand-written MDX file into article data.
 *
 * @throws {ManagerDocsParseError} When the file uses syntax outside the v0 grammar.
 */
export function parseManagerDocs(source: string, file: string): DocsPage {
  const text = source.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).map((line, index) => ({
    text: line,
    line: index + 1,
    column: 1,
  }));
  if (isFrontmatter(lines)) {
    parseFailure(
      file,
      1,
      1,
      'frontmatter',
      'Frontmatter is not allowed. Start the page with Markdown or a CSF import.'
    );
  }

  const scope: BlockScope = {
    docsAlias: previewDocsAlias(lines),
    components: componentBindings(lines),
    nested: false,
  };
  const imports: CsfImport[] = [];
  const importedNames: {
    name: string;
    position: SourcePosition;
    kind: 'namespace' | 'csf' | 'component';
  }[] = [];
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].text.trim() === '') {
      index += 1;
      continue;
    }
    if (isImportStart(lines[index].text)) {
      const parsed = parseImport(lines, index, file);
      if (parsed.kind === 'namespace') {
        if (importedNames.some((imported) => imported.kind === 'namespace')) {
          parseFailure(
            file,
            parsed.position.line,
            parsed.position.column,
            'import',
            `Only one namespace import from '${MANAGER_DOCS_MDX_SPECIFIER}' is allowed.`
          );
        }
        importedNames.push({
          name: parsed.alias,
          position: parsed.position,
          kind: 'namespace',
        });
        index = parsed.next;
        continue;
      }
      if (parsed.kind === 'component') {
        for (const binding of parsed.bindings) {
          importedNames.push({ name: binding, position: parsed.position, kind: 'component' });
        }
        index = parsed.next;
        continue;
      }
      for (const binding of parsed.statement.bindings) {
        importedNames.push({ name: binding, position: parsed.statement.position, kind: 'csf' });
      }
      imports.push(parsed.statement);
      index = parsed.next;
      continue;
    }
    if (isExportStart(lines[index].text)) {
      parseFailure(
        file,
        lines[index].line,
        contentColumn(lines[index]),
        'export',
        'Exports are not allowed. MDX is data, not a module that runs in the manager.'
      );
    }
    const parsed = parseBlock(lines, index, file, scope);
    blocks.push(parsed.block);
    index = parsed.next;
  }

  const bindings = new Set<string>();
  for (const imported of importedNames) {
    if (bindings.has(imported.name)) {
      parseFailure(
        file,
        imported.position.line,
        imported.position.column,
        'import',
        `The name "${imported.name}" is imported more than once.`
      );
    }
    bindings.add(imported.name);
  }

  return { imports, blocks };
}

function isFrontmatter(lines: SourceLine[]): boolean {
  if (lines.length < 3) {
    return false;
  }
  if (!/^---\s*$/.test(lines[0].text) || lines[1].text.trim() === '') {
    return false;
  }
  return lines.slice(2).some((line) => /^---\s*$/.test(line.text));
}

function isImportStart(text: string): boolean {
  return (
    /^\s*import\s*\(/.test(text) ||
    /^\s*import\s+type\b/.test(text) ||
    /^\s*import\s+['"]/.test(text) ||
    /^\s*import\s+\*\s+as\b/.test(text) ||
    /^\s*import\s*\{/.test(text) ||
    /^\s*import\s+[A-Za-z_$][\w$]*\s*(?:,|\{|\s+from\b)/.test(text) ||
    /^\s*import\s+[A-Za-z_$][\w$]*\s*$/.test(text)
  );
}

function isExportStart(text: string): boolean {
  return /^\s*export\s+(?:type|default|const|let|var|function|class|async|enum|interface|abstract|declare|\{|\*)/.test(
    text
  );
}

function isLinkReferenceDefinition(text: string): boolean {
  return /^\s{0,3}\[[^\]\n]+\]:[ \t]+\S/.test(text);
}

function isTagAngle(text: string, index: number): boolean {
  const next = text[index + 1] ?? '';
  return next === '/' || next === '!' || next === '?' || /[A-Za-z]/.test(next);
}

function previewDocsAlias(lines: SourceLine[]): string | undefined {
  let alias: string | undefined;
  let index = 0;
  while (index < lines.length) {
    if (isFence(lines[index].text)) {
      index = skipFence(lines, index);
      continue;
    }
    if (!isImportStart(lines[index].text) || /^\s*import\s+type\b/.test(lines[index].text)) {
      index += 1;
      continue;
    }
    const read = readImportText(lines, index);
    if (!read) {
      index += 1;
      continue;
    }
    index = read.next;
    const namespace = namespaceAlias(flattenImport(read.statement));
    if (namespace && alias === undefined) {
      alias = namespace;
    }
  }
  return alias;
}

function componentBindings(lines: SourceLine[]): Map<string, ComponentBinding> {
  const bindings = new Map<string, ComponentBinding>();
  let index = 0;
  while (index < lines.length) {
    if (isFence(lines[index].text)) {
      index = skipFence(lines, index);
      continue;
    }
    if (!isImportStart(lines[index].text)) {
      index += 1;
      continue;
    }
    const read = readImportText(lines, index);
    if (!read) {
      index += 1;
      continue;
    }
    index = read.next;
    const imported = matchComponentImport(flattenImport(read.statement));
    for (const binding of imported?.bindings ?? []) {
      bindings.set(binding.local, { source: imported!.source, exportName: binding.exportName });
    }
  }
  return bindings;
}

function isComponentSource(source: string): boolean {
  return (
    source !== MANAGER_DOCS_MDX_SPECIFIER &&
    !CSF_SPECIFIER.test(source) &&
    !DOCS_BLOCKS_SPECIFIER.test(source)
  );
}

function matchComponentImport(
  statement: string
): { source: string; bindings: { local: string; exportName: string }[] } | undefined {
  if (/^import\s+type\b/.test(statement)) {
    return undefined;
  }
  const from = statement.match(/\sfrom\s+(['"])([^'"]+)\1$/);
  if (!from || !isComponentSource(from[2])) {
    return undefined;
  }
  const head = statement.slice(0, from.index).trim();
  const parts = head.match(/^import\s+(?:([A-Za-z_$][\w$]*)\s*(?:,\s*)?)?(?:\{([^}]*)\})?$/);
  if (!parts || (!parts[1] && parts[2] === undefined)) {
    return undefined;
  }
  const bindings = parts[1] ? [{ local: parts[1], exportName: 'default' }] : [];
  for (const part of (parts[2] ?? '').split(',')) {
    const named = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (named) {
      bindings.push({ local: named[2] ?? named[1], exportName: named[1] });
    }
  }
  return { source: from[2], bindings };
}

function skipFence(lines: SourceLine[], start: number): number {
  const open = lines[start].text.match(/^\s{0,3}(`{3,}|~{3,})/);
  const fence = open?.[1] ?? '```';
  let index = start + 1;
  while (index < lines.length) {
    const closer = lines[index].text.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
    index += 1;
    if (closer && closer[1][0] === fence[0] && closer[1].length >= fence.length) {
      break;
    }
  }
  return index;
}

function readImportText(
  lines: SourceLine[],
  start: number
): { statement: string; next: number } | undefined {
  let statement = '';
  let index = start;
  while (index < lines.length) {
    statement += `${lines[index].text}\n`;
    index += 1;
    if (
      /;\s*$/.test(statement.trim()) ||
      /\sfrom\s+['"][^'"]+['"]\s*;?\s*$/.test(statement.trim())
    ) {
      return { statement, next: index };
    }
    if (index - start > 30) {
      return undefined;
    }
  }
  return { statement, next: index };
}

function flattenImport(statement: string): string {
  return statement.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();
}

function namespaceAlias(statement: string): string | undefined {
  const specifier = statement.match(/\sfrom\s+(['"])([^'"]+)\1$/);
  if (!specifier || specifier[2] !== MANAGER_DOCS_MDX_SPECIFIER || specifier.index === undefined) {
    return undefined;
  }
  const head = statement.slice(0, specifier.index).trim();
  return head.match(/^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)$/)?.[1];
}

function parseImport(
  lines: SourceLine[],
  start: number,
  file: string
):
  | { kind: 'csf'; statement: CsfImport; next: number }
  | { kind: 'component'; bindings: string[]; position: SourcePosition; next: number }
  | { kind: 'namespace'; alias: string; position: SourcePosition; next: number } {
  const first = lines[start];
  const column = contentColumn(first);
  if (/^\s*import\s*\(/.test(first.text)) {
    parseFailure(file, first.line, column, 'import', 'Dynamic import() is not allowed.');
  }
  if (/^\s*import\s+type\b/.test(first.text)) {
    parseFailure(file, first.line, column, 'import', 'Type imports are not allowed.');
  }

  const read = readImportText(lines, start);
  if (!read) {
    parseFailure(file, first.line, column, 'import', 'This import does not end.');
  }
  const { statement, next: index } = read;

  const flattened = flattenImport(statement);
  const alias = namespaceAlias(flattened);
  if (alias) {
    return {
      kind: 'namespace',
      alias,
      position: { line: first.line, column },
      next: index,
    };
  }
  if (importsManagerDocsMdx(flattened)) {
    parseFailure(
      file,
      first.line,
      column,
      'import',
      headImportsStory(flattened)
        ? `'<Story>' is used as <Alias.Story> after import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
        : `Only a namespace import is valid: import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );
  }
  const parsed = matchStaticImport(flattened);
  if (!parsed) {
    parseFailure(
      file,
      first.line,
      column,
      'import',
      'Only static ESM imports of CSF modules are allowed.'
    );
  }
  if (isComponentSource(parsed.source)) {
    return {
      kind: 'component',
      bindings: parsed.bindings,
      position: { line: first.line, column },
      next: index,
    };
  }
  if (!CSF_SPECIFIER.test(parsed.source)) {
    const specifierColumn = statement.indexOf(parsed.source);
    const located = offsetToLine(lines, start, specifierColumn < 0 ? 0 : specifierColumn);
    parseFailure(
      file,
      located.line,
      located.column,
      'import',
      `Import "${parsed.source}" is a docs blocks module. Use <Alias.Story> or your own component.`
    );
  }

  return {
    kind: 'csf',
    statement: {
      bindings: parsed.bindings,
      source: parsed.source,
      position: { line: first.line, column },
    },
    next: index,
  };
}

function importsManagerDocsMdx(statement: string): boolean {
  const specifier = statement.match(/\sfrom\s+(['"])([^'"]+)\1$/);
  return specifier?.[2] === MANAGER_DOCS_MDX_SPECIFIER;
}

function headImportsStory(statement: string): boolean {
  const specifier = statement.match(/\sfrom\s+(['"])([^'"]+)\1$/);
  const head = specifier?.index === undefined ? statement : statement.slice(0, specifier.index);
  if (/^import\s+Story\b/.test(head.trim())) {
    return true;
  }
  const named = head.match(/\{([^}]*)\}/);
  if (!named) {
    return false;
  }
  return named[1].split(',').some((part) => part.trim().match(/^Story\b/) !== null);
}

function matchStaticImport(statement: string): { bindings: string[]; source: string } | undefined {
  const from = statement.match(/\sfrom\s+(['"])([^'"]+)\1$/);
  if (!from) {
    return undefined;
  }
  const source = from[2];
  const head = statement.slice(0, from.index).trim();
  const namespace = head.match(/^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)$/);
  if (namespace) {
    return { bindings: [namespace[1]], source };
  }
  const named = head.match(/^import\s+\{([^}]*)\}$/);
  if (named) {
    const bindings = parseNamedBindings(named[1]);
    return bindings && bindings.length > 0 ? { bindings, source } : undefined;
  }
  const defaults = head.match(/^import\s+([A-Za-z_$][\w$]*)$/);
  if (defaults) {
    return { bindings: [defaults[1]], source };
  }
  const mixedNamed = head.match(/^import\s+([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}$/);
  if (mixedNamed) {
    const bindings = parseNamedBindings(mixedNamed[2]);
    return bindings && bindings.length > 0
      ? { bindings: [mixedNamed[1], ...bindings], source }
      : undefined;
  }
  const mixedNamespace = head.match(
    /^import\s+([A-Za-z_$][\w$]*)\s*,\s*\*\s+as\s+([A-Za-z_$][\w$]*)$/
  );
  if (mixedNamespace) {
    return { bindings: [mixedNamespace[1], mixedNamespace[2]], source };
  }
  return undefined;
}

function parseNamedBindings(list: string): string[] | undefined {
  if (list.trim() === '') {
    return [];
  }
  const names: string[] = [];
  for (const part of list.split(',')) {
    if (part.trim() === '') {
      continue;
    }
    const alias = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (!alias) {
      return undefined;
    }
    names.push(alias[2] ?? alias[1]);
  }
  return names;
}

function contentColumn(line: SourceLine): number {
  const index = line.text.search(/\S/);
  return line.column + (index < 0 ? 0 : index);
}

function offsetToLine(
  lines: SourceLine[],
  start: number,
  offset: number
): { line: number; column: number } {
  let remaining = offset;
  for (let index = start; index < lines.length; index += 1) {
    const text = lines[index].text;
    if (remaining <= text.length) {
      return { line: lines[index].line, column: lines[index].column + remaining };
    }
    remaining -= text.length + 1;
  }
  const last = lines[Math.min(start, lines.length - 1)];
  return { line: last.line, column: last.column };
}

function parseBlock(
  lines: SourceLine[],
  start: number,
  file: string,
  scope: BlockScope
): { block: Block; next: number } {
  const { docsAlias } = scope;
  const line = lines[start];
  const trimmed = line.text.trim();
  const tag = matchBlockTag(line.text);
  if (tag && (tag.name === 'Story' || (tag.alias !== undefined && tag.alias === docsAlias))) {
    if (!isStoryTag(tag, docsAlias) || !docsAlias) {
      rejectStoryTag(line, file, tag, docsAlias);
    }
    return parseStory(lines, start, file, `${docsAlias}.Story`);
  }
  const component = tag && !tag.alias ? scope.components.get(tag.name) : undefined;
  if (tag && component) {
    if (scope.nested) {
      parseFailure(
        file,
        line.line,
        line.column + Math.max(line.text.indexOf('<'), 0),
        'component',
        `<${tag.name}> cannot be nested. Put it on its own lines at the top level of the page.`
      );
    }
    return parseComponent(lines, start, file, tag.name, component);
  }
  if (/^\s*<\/?[A-Za-z!]/.test(line.text) || /^\s*<!--/.test(line.text)) {
    rejectTag(line, file, docsAlias);
  }
  const heading = line.text.match(/^\s{0,3}(#{1,6})(?:[ \t]+(.*?)(?:[ \t]+#+)?)?\s*$/);
  if (heading) {
    const marker = line.text.match(/^\s{0,3}#{1,6}[ \t]*/);
    return {
      block: {
        type: 'heading',
        depth: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(
          heading[2] ?? '',
          file,
          line.line,
          line.column + (marker?.[0].length ?? 0)
        ),
      },
      next: start + 1,
    };
  }
  if (isFence(line.text)) {
    return parseFence(lines, start, file);
  }
  if (isThematicBreak(line.text)) {
    return { block: { type: 'thematicBreak' }, next: start + 1 };
  }
  if (/^\s{0,3}>/.test(line.text)) {
    return parseBlockquote(lines, start, file, { ...scope, nested: true });
  }
  if (matchListMarker(line.text)) {
    return parseList(lines, start, file, { ...scope, nested: true });
  }
  if (isTableStart(lines, start)) {
    return parseTable(lines, start, file);
  }
  if (/^( {4}|\t)/.test(line.text) && trimmed !== '') {
    return parseIndentedCode(lines, start);
  }
  if (isLinkReferenceDefinition(line.text)) {
    parseFailure(
      file,
      line.line,
      contentColumn(line),
      'markdown',
      'Link reference definitions are not supported. Use [text](url).'
    );
  }
  return parseParagraph(lines, start, file);
}

function matchBlockTag(text: string): { alias?: string; name: string } | undefined {
  const match = text.match(/^\s*<([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?(?=[\s/>]|$)/);
  if (!match) {
    return undefined;
  }
  if (match[2]) {
    return { alias: match[1], name: match[2] };
  }
  return { name: match[1] };
}

function isStoryTag(tag: { alias?: string; name: string }, docsAlias: string | undefined): boolean {
  return tag.alias !== undefined && tag.alias === docsAlias && tag.name === 'Story';
}

function rejectStoryTag(
  line: SourceLine,
  file: string,
  tag: { alias?: string; name: string },
  docsAlias: string | undefined
): never {
  const column = line.column + Math.max(line.text.indexOf('<'), 0);
  if (tag.alias === undefined) {
    parseFailure(
      file,
      line.line,
      column,
      'story',
      `'<Story>' is not valid. Import the namespace and use <Alias.Story>: import * as Alias from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );
  }
  if (!docsAlias) {
    parseFailure(
      file,
      line.line,
      column,
      'story',
      `Import the namespace and use <${tag.alias}.Story>: import * as ${tag.alias} from '${MANAGER_DOCS_MDX_SPECIFIER}'.`
    );
  }
  if (tag.alias !== docsAlias) {
    parseFailure(
      file,
      line.line,
      column,
      'story',
      `The namespace "${tag.alias}" does not match "${docsAlias}". Use <${docsAlias}.Story>.`
    );
  }
  parseFailure(
    file,
    line.line,
    column,
    'component',
    `<${tag.alias}.${tag.name}> is not part of the v0 grammar. The only block is <${docsAlias}.Story>.`
  );
}

function rejectTag(line: SourceLine, file: string, docsAlias: string | undefined): never {
  const column = line.column + Math.max(line.text.indexOf('<'), 0);
  const comment = /^\s*<!--/.test(line.text);
  const name = line.text.match(/<\/?([A-Za-z][\w.-]*)/);
  const story = docsAlias ? `<${docsAlias}.Story>` : '<Alias.Story>';
  if (comment || (name && name[1][0] === name[1][0].toLowerCase())) {
    parseFailure(
      file,
      line.line,
      column,
      'html',
      'Raw HTML is not allowed. Use Markdown, or a Story block for an example.'
    );
  }
  parseFailure(
    file,
    line.line,
    column,
    'component',
    `<${name?.[1] ?? 'Unknown'}> is not part of the v0 grammar. Blocks are ${story} or an imported component.`
  );
}

function parseComponent(
  lines: SourceLine[],
  start: number,
  file: string,
  name: string,
  binding: ComponentBinding
): { block: Block; next: number } {
  const origin = lines[start];
  const openOffset = Math.max(origin.text.indexOf('<'), 0);
  let end = start;
  while (end < lines.length && lines[end].text.trim() !== '') {
    end += 1;
  }
  const raw = lines
    .slice(start, end)
    .map((line) => line.text)
    .join('\n');
  const fail = (offset: number, construct: string, message: string): never => {
    const at = offsetToLine(lines, start, offset);
    return parseFailure(file, at.line, at.column, construct, message);
  };

  const open = readComponentOpenTag(raw, openOffset, name, fail);
  let cursor = open.next;
  let children: string | undefined;
  if (!open.selfClosing) {
    const closeTag = `</${name}>`;
    const close = raw.indexOf(closeTag, cursor);
    if (close === -1) {
      fail(
        openOffset,
        'component',
        `<${name}> must close with ${closeTag} or />, without a blank line inside.`
      );
    }
    children = componentChildren(raw.slice(cursor, close), cursor, name, fail);
    cursor = close + closeTag.length;
  }
  const rest = raw.slice(cursor);
  if (rest.trim() !== '') {
    fail(
      cursor + rest.search(/\S/),
      'component',
      `Nothing can follow <${name}> in the same block.`
    );
  }
  return {
    block: {
      type: 'component',
      blockId: componentBlockId(file, binding.source, binding.exportName),
      importSource: binding.source,
      exportName: binding.exportName,
      props: open.props,
      ...(children !== undefined ? { children } : {}),
      position: { line: origin.line, column: origin.column + openOffset },
    },
    next: end,
  };
}

function readComponentOpenTag(
  raw: string,
  openOffset: number,
  name: string,
  fail: (offset: number, construct: string, message: string) => never
): { props: ComponentProps; selfClosing: boolean; next: number } {
  const props: ComponentProps = {};
  let cursor = openOffset + 1 + name.length;
  const skipSpace = () => {
    while (cursor < raw.length && /\s/.test(raw[cursor])) {
      cursor += 1;
    }
  };
  while (true) {
    skipSpace();
    if (raw.startsWith('/>', cursor)) {
      return { props, selfClosing: true, next: cursor + 2 };
    }
    if (raw[cursor] === '>') {
      return { props, selfClosing: false, next: cursor + 1 };
    }
    if (cursor >= raw.length) {
      fail(openOffset, 'component', `<${name}> is missing its closing >.`);
    }
    if (raw[cursor] === '{') {
      fail(
        cursor,
        'component-prop',
        raw.startsWith('{...', cursor)
          ? `<${name}> does not allow spread props.`
          : `<${name}> props must be name="value" or name={literal}.`
      );
    }
    const propName = raw.slice(cursor).match(/^[A-Za-z_$][\w$-]*/)?.[0];
    if (!propName) {
      fail(cursor, 'component-prop', `Unreadable <${name}> prop.`);
    }
    const propAt = cursor;
    if (propName === 'children') {
      fail(propAt, 'component-prop', `Put <${name}> children as text between the tags.`);
    }
    if (Object.hasOwn(props, propName)) {
      fail(propAt, 'component-prop', `<${name}> has more than one ${propName} prop.`);
    }
    cursor += propName.length;
    skipSpace();
    if (raw[cursor] !== '=') {
      props[propName] = true;
      continue;
    }
    cursor += 1;
    skipSpace();
    const quote = raw[cursor];
    if (quote === '"' || quote === "'") {
      const close = raw.indexOf(quote, cursor + 1);
      if (close === -1 || raw.slice(cursor, close).includes('\n')) {
        fail(propAt, 'component-prop', `<${name} ${propName}> is missing a closing ${quote}.`);
      }
      props[propName] = raw.slice(cursor + 1, close);
      cursor = close + 1;
      continue;
    }
    if (quote === '{') {
      const braced = readBracedValue(raw, cursor);
      const literal = braced ? literalPropValue(braced.value.slice(1, -1).trim()) : undefined;
      if (!braced || literal === undefined) {
        fail(
          propAt,
          'component-prop',
          `<${name} ${propName}> must be a literal string, number, or boolean.`
        );
      }
      props[propName] = literal;
      cursor = braced.next;
      continue;
    }
    fail(propAt, 'component-prop', `<${name} ${propName}> needs a value.`);
  }
}

function literalPropValue(body: string): string | number | boolean | undefined {
  if (body === 'true' || body === 'false') {
    return body === 'true';
  }
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(body)) {
    return Number(body);
  }
  const string = body.match(/^(['"])([^'"\\\n]*)\1$/);
  return string ? string[2] : undefined;
}

function componentChildren(
  text: string,
  offset: number,
  name: string,
  fail: (offset: number, construct: string, message: string) => never
): string | undefined {
  const tag = text.search(/</);
  if (tag !== -1) {
    fail(
      offset + tag,
      'component',
      `<${name}> children must be plain text. Components and HTML cannot be nested inside it.`
    );
  }
  const expression = text.search(/[{}]/);
  if (expression !== -1) {
    fail(offset + expression, 'expression', `<${name}> children cannot contain expressions.`);
  }
  const markdown = text.search(/[`*[\]]|^[ \t]*(?:#{1,6}\s|>|[-+]\s|\d+[.)]\s)/m);
  if (markdown !== -1) {
    fail(offset + markdown, 'component', `<${name}> children must be plain text, not Markdown.`);
  }
  const collapsed = text.trim().replace(/\s+/g, ' ');
  return collapsed === '' ? undefined : collapsed;
}

function parseStory(
  lines: SourceLine[],
  start: number,
  file: string,
  tag: string
): { block: Block; next: number } {
  const origin = lines[start];
  const openColumn = origin.column + Math.max(origin.text.indexOf('<'), 0);
  let raw = '';
  let index = start;
  let closed = false;
  while (index < lines.length) {
    const text = lines[index].text;
    raw += index === start ? text : `\n${text}`;
    if (text.includes('/>')) {
      closed = true;
      index += 1;
      break;
    }
    if (text.includes('>')) {
      parseFailure(
        file,
        lines[index].line,
        lines[index].column + text.indexOf('>'),
        'story-children',
        '<Story> cannot have children. Close it with />.'
      );
    }
    index += 1;
    if (index - start > 20) {
      break;
    }
  }
  if (!closed) {
    parseFailure(
      file,
      origin.line,
      openColumn,
      'story-children',
      '<Story> must be self-closing and cannot contain children.'
    );
  }

  const end = raw.indexOf('/>');
  const after = raw.slice(end + 2).trim();
  if (after !== '') {
    parseFailure(
      file,
      origin.line,
      openColumn,
      'story-children',
      'Nothing can follow <Story /> on the same block.'
    );
  }
  const open = `<${tag}`;
  const inner = raw.slice(raw.indexOf(open) + open.length, end);
  const attributes = parseStoryAttributes(inner, lines, start, file, open);
  return {
    block: {
      type: 'story',
      moduleName: attributes.moduleName,
      exportName: attributes.exportName,
      focus: attributes.focus,
      ...(attributes.height !== undefined ? { height: attributes.height } : {}),
      ...(attributes.ratio !== undefined ? { ratio: attributes.ratio } : {}),
      ...(attributes.toolbar !== undefined ? { toolbar: attributes.toolbar } : {}),
      ...(attributes.panel !== undefined ? { panel: attributes.panel } : {}),
      position: { line: origin.line, column: openColumn },
    },
    next: index,
  };
}

function parseStoryAttributes(
  inner: string,
  lines: SourceLine[],
  start: number,
  file: string,
  open: string
): {
  moduleName: string;
  exportName: string;
  focus: boolean;
  height?: StoryFrameHeight;
  ratio?: number;
  toolbar?: boolean;
  panel?: StoryPanel;
} {
  let moduleName: string | undefined;
  let exportName: string | undefined;
  let focus: boolean | undefined;
  let height: StoryFrameHeight | undefined;
  let ratio: number | undefined;
  let sawHeight = false;
  let sawRatio = false;
  let toolbar: boolean | undefined;
  let panel: StoryPanel | undefined;
  let cursor = 0;
  const locate = (offset: number) => {
    const storyOffset = lines[start].text.indexOf(open);
    return offsetToLine(lines, start, storyOffset + open.length + offset);
  };

  while (cursor < inner.length) {
    while (cursor < inner.length && /\s/.test(inner[cursor])) {
      cursor += 1;
    }
    if (cursor >= inner.length) {
      break;
    }
    const nameMatch = inner.slice(cursor).match(/^([A-Za-z_][\w-]*)/);
    if (!nameMatch) {
      const at = locate(cursor);
      parseFailure(file, at.line, at.column, 'story-attribute', 'Unreadable <Story> attribute.');
    }
    const name = nameMatch[1];
    const nameAt = locate(cursor);
    cursor += name.length;
    while (cursor < inner.length && /\s/.test(inner[cursor])) {
      cursor += 1;
    }
    let value: string | undefined;
    if (inner[cursor] === '=') {
      cursor += 1;
      while (cursor < inner.length && /\s/.test(inner[cursor])) {
        cursor += 1;
      }
      if (inner[cursor] === '{') {
        const braced = readBracedValue(inner, cursor);
        if (!braced) {
          parseFailure(
            file,
            nameAt.line,
            nameAt.column,
            'expression',
            `<Story ${name}> is missing a closing }.`
          );
        }
        value = braced.value;
        cursor = braced.next;
      } else if (inner[cursor] === '"' || inner[cursor] === "'") {
        const quote = inner[cursor];
        const close = inner.indexOf(quote, cursor + 1);
        value = inner.slice(cursor, close === -1 ? inner.length : close + 1);
        cursor = close === -1 ? inner.length : close + 1;
      } else {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          `<Story ${name}> needs a value in braces or a boolean attribute.`
        );
      }
    }

    if (name === 'id') {
      parseFailure(
        file,
        nameAt.line,
        nameAt.column,
        'story-id',
        'String story ids are not allowed. Use of={Module.Story}.'
      );
    }
    if (name === 'of') {
      if (moduleName) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one of attribute.'
        );
      }
      const member = value?.match(/^\{\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\}$/);
      if (!member || !IDENTIFIER.test(member[1]) || !IDENTIFIER.test(member[2])) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          storyOfConstruct(value),
          'of must be a static member expression of={Module.Story}.'
        );
      }
      moduleName = member[1];
      exportName = member[2];
      continue;
    }
    if (name === 'focus') {
      if (focus !== undefined) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one focus attribute.'
        );
      }
      const literal = value?.match(/^\{\s*(true|false)\s*\}$/);
      if (value === undefined) {
        focus = true;
      } else if (literal) {
        focus = literal[1] === 'true';
      } else {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-focus',
          'focus must be a boolean: focus, focus={true}, or focus={false}.'
        );
      }
      continue;
    }
    if (name === 'height') {
      if (sawHeight) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one height attribute.'
        );
      }
      sawHeight = true;
      const parsed = parseStoryHeight(value);
      if (!parsed) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-height',
          'height must be "auto", a positive integer number of pixels, or "100vh".'
        );
      }
      if (sawRatio) {
        rejectStorySize(file, nameAt.line, nameAt.column);
      }
      if (parsed.kind === 'fixed') {
        height = parsed.value;
      }
      continue;
    }
    if (name === 'ratio') {
      if (sawRatio) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one ratio attribute.'
        );
      }
      sawRatio = true;
      const parsed = parseStoryRatio(value);
      if (parsed === undefined) {
        parseFailure(file, nameAt.line, nameAt.column, 'story-ratio', ratioError(value));
      }
      if (sawHeight) {
        rejectStorySize(file, nameAt.line, nameAt.column);
      }
      ratio = parsed;
      continue;
    }
    if (name === 'toolbar') {
      if (toolbar !== undefined) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one toolbar attribute.'
        );
      }
      toolbar = parseStoryToolbar(value, file, nameAt.line, nameAt.column);
      continue;
    }
    if (name === 'panels') {
      parseFailure(
        file,
        nameAt.line,
        nameAt.column,
        'story-panel',
        'panels is not a <Story> attribute. Use panel.'
      );
    }
    if (name === 'panel') {
      if (panel !== undefined) {
        parseFailure(
          file,
          nameAt.line,
          nameAt.column,
          'story-attribute',
          '<Story> has more than one panel attribute.'
        );
      }
      panel = parseStoryPanel(value, file, nameAt.line, nameAt.column);
      continue;
    }
    parseFailure(
      file,
      nameAt.line,
      nameAt.column,
      'story-attribute',
      `<Story> does not allow the "${name}" attribute.`
    );
  }

  if (!moduleName || !exportName) {
    const at = locate(0);
    parseFailure(file, at.line, at.column, 'story-of', '<Story> requires of={Module.Story}.');
  }
  return {
    moduleName,
    exportName,
    focus: focus ?? false,
    ...(height !== undefined ? { height } : {}),
    ...(ratio !== undefined ? { ratio } : {}),
    ...(toolbar !== undefined ? { toolbar } : {}),
    ...(panel !== undefined ? { panel } : {}),
  };
}

function rejectStorySize(file: string, line: number, column: number): never {
  parseFailure(file, line, column, 'story-attribute', 'height and ratio are mutually exclusive.');
}

function parseStoryHeight(
  value: string | undefined
): { kind: 'auto' } | { kind: 'fixed'; value: StoryFrameHeight } | undefined {
  if (!value) {
    return undefined;
  }
  const literal = staticString(value);
  if (literal !== undefined) {
    if (literal === 'auto') {
      return { kind: 'auto' };
    }
    if (literal === '100vh') {
      return { kind: 'fixed', value: '100vh' };
    }
    const pixels = positiveInteger(literal);
    return pixels === undefined ? undefined : { kind: 'fixed', value: pixels };
  }
  const body = bracedBody(value);
  if (body === undefined) {
    return undefined;
  }
  const pixels = positiveInteger(body);
  return pixels === undefined ? undefined : { kind: 'fixed', value: pixels };
}

function parseStoryRatio(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const literal = staticString(value);
  if (literal === undefined) {
    return undefined;
  }
  const parts = literal.split('/').map((part) => part.trim());
  if (parts.length === 1) {
    return positiveNumber(parts[0]);
  }
  if (parts.length !== 2) {
    return undefined;
  }
  const width = positiveNumber(parts[0]);
  const height = positiveNumber(parts[1]);
  if (width === undefined || height === undefined) {
    return undefined;
  }
  return width / height;
}

function ratioError(value: string | undefined): string {
  if (value?.includes('{') && staticString(value ?? '') === undefined) {
    return 'ratio must be a static string such as "16/9", not an expression.';
  }
  return 'ratio must be a static string such as "16/9".';
}

function staticString(value: string): string | undefined {
  const direct = value.match(/^(['"])([\s\S]*)\1$/);
  if (direct) {
    return direct[2].trim();
  }
  const braced = value.match(/^\{(\s*(['"])([\s\S]*?)\2\s*)\}$/);
  if (!braced) {
    return undefined;
  }
  return braced[3].trim();
}

function bracedBody(value: string): string | undefined {
  const braced = value.match(/^\{([\s\S]*)\}$/);
  return braced ? braced[1].trim() : undefined;
}

function positiveInteger(token: string): number | undefined {
  if (!/^[1-9]\d*$/.test(token)) {
    return undefined;
  }
  const parsed = Number(token);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveNumber(token: string): number | undefined {
  if (!/^(?:[1-9]\d*(?:\.\d+)?|0\.\d+)$/.test(token)) {
    return undefined;
  }
  const parsed = Number(token);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readBracedValue(
  source: string,
  open: number
): { value: string; next: number } | undefined {
  let depth = 0;
  let index = open;
  let quote: string | undefined;
  while (index < source.length) {
    const char = source[index];
    if (quote) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      index += 1;
      continue;
    }
    if (char === '{') {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        return { value: source.slice(open, index), next: index };
      }
      continue;
    }
    index += 1;
  }
  return undefined;
}

function parseStoryPanel(
  value: string | undefined,
  file: string,
  line: number,
  column: number
): StoryPanel {
  const body = bracedBody(value ?? '');
  if (body === 'true') {
    return true;
  }
  if (body === 'false') {
    return false;
  }
  if (body !== undefined && body.startsWith('[') && body.endsWith(']')) {
    return parseStoryIdList('panel', value, STORY_PANEL_IDS, file, line, column);
  }
  invalidStoryPanel(file, line, column);
}

function parseStoryToolbar(
  value: string | undefined,
  file: string,
  line: number,
  column: number
): boolean {
  const body = bracedBody(value ?? '');
  if (body === 'true') {
    return true;
  }
  if (body === 'false' || (body !== undefined && /^\[\s*\]$/.test(body))) {
    return false;
  }
  parseFailure(file, line, column, 'story-toolbar', 'toolbar must be true, false, or [].');
}

function invalidStoryPanel(file: string, line: number, column: number): never {
  parseFailure(
    file,
    line,
    column,
    'story-panel',
    'panel must be true, false, or a static array of "actions" and "interactions".'
  );
}

function parseStoryIdList<Id extends string>(
  name: 'panel',
  value: string | undefined,
  allowed: readonly Id[],
  file: string,
  line: number,
  column: number
): Id[] {
  const construct = 'story-panel';
  if (value === undefined || !value.startsWith('{') || !value.endsWith('}')) {
    invalidStoryPanel(file, line, column);
  }
  const body = value.slice(1, -1).trim();
  if (!body.startsWith('[') || !body.endsWith(']')) {
    invalidStoryPanel(file, line, column);
  }
  const items = readStringLiterals(body.slice(1, -1));
  if (!items) {
    invalidStoryPanel(file, line, column);
  }
  const seen = new Set<Id>();
  const ids: Id[] = [];
  for (const item of items) {
    if (!(allowed as readonly string[]).includes(item)) {
      parseFailure(file, line, column, construct, `${name} does not allow "${item}".`);
    }
    const id = item as Id;
    if (seen.has(id)) {
      parseFailure(file, line, column, construct, `${name} lists "${item}" more than once.`);
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function readStringLiterals(source: string): string[] | undefined {
  const items: string[] = [];
  let index = 0;
  const skip = () => {
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }
  };
  skip();
  while (index < source.length) {
    const quote = source[index];
    if (quote !== '"' && quote !== "'") {
      return undefined;
    }
    const close = source.indexOf(quote, index + 1);
    const literal = close === -1 ? undefined : source.slice(index + 1, close);
    if (
      literal === undefined ||
      literal.includes('\\') ||
      literal.includes('\n') ||
      literal.includes('\r')
    ) {
      return undefined;
    }
    items.push(literal);
    index = close + 1;
    skip();
    if (index >= source.length) {
      return items;
    }
    if (source[index] !== ',') {
      return undefined;
    }
    index += 1;
    skip();
  }
  return items;
}

function storyOfConstruct(value: string | undefined): 'expression' | 'story-id' {
  if (!value || value.startsWith('"') || value.startsWith("'") || /^\{\s*['"]/.test(value)) {
    return 'story-id';
  }
  return 'expression';
}

function isFence(text: string): boolean {
  return /^\s{0,3}(`{3,}|~{3,})/.test(text);
}

function parseFence(
  lines: SourceLine[],
  start: number,
  file: string
): { block: Block; next: number } {
  const open = lines[start].text.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
  if (!open) {
    parseFailure(
      file,
      lines[start].line,
      contentColumn(lines[start]),
      'code',
      'Unclosed code fence.'
    );
  }
  const fence = open[1];
  const info = open[2].trim();
  if (info.includes('`')) {
    parseFailure(
      file,
      lines[start].line,
      contentColumn(lines[start]),
      'code',
      'A code fence info string cannot contain a backtick.'
    );
  }
  const lang = info.split(/\s+/)[0] || null;
  const body: string[] = [];
  let index = start + 1;
  let closed = false;
  while (index < lines.length) {
    const closer = lines[index].text.match(/^\s{0,3}(`{3,}|~{3,})\s*$/);
    if (closer && closer[1][0] === fence[0] && closer[1].length >= fence.length) {
      closed = true;
      index += 1;
      break;
    }
    body.push(lines[index].text);
    index += 1;
  }
  if (!closed) {
    parseFailure(
      file,
      lines[start].line,
      contentColumn(lines[start]),
      'code',
      'This code fence never closes.'
    );
  }
  return {
    block: { type: 'code', lang, value: body.join('\n') },
    next: index,
  };
}

function parseIndentedCode(lines: SourceLine[], start: number): { block: Block; next: number } {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const text = lines[index].text;
    if (text.trim() === '') {
      const next = nextNonBlank(lines, index + 1);
      if (next !== -1 && /^( {4}|\t)/.test(lines[next].text)) {
        body.push('');
        index += 1;
        continue;
      }
      break;
    }
    if (!/^( {4}|\t)/.test(text)) {
      break;
    }
    body.push(text.replace(/^( {4}|\t)/, ''));
    index += 1;
  }
  return { block: { type: 'code', lang: null, value: body.join('\n') }, next: index };
}

function isThematicBreak(text: string): boolean {
  return /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text);
}

function parseBlockquote(
  lines: SourceLine[],
  start: number,
  file: string,
  scope: BlockScope
): { block: Block; next: number } {
  const inner: SourceLine[] = [];
  let index = start;
  while (index < lines.length && /^\s{0,3}>/.test(lines[index].text)) {
    const marker = lines[index].text.match(/^\s{0,3}>\s?/);
    const removed = marker?.[0].length ?? 0;
    inner.push({
      line: lines[index].line,
      column: lines[index].column + removed,
      text: lines[index].text.slice(removed),
    });
    index += 1;
  }
  return {
    block: { type: 'blockquote', children: parseBlocks(inner, file, scope) },
    next: index,
  };
}

function parseBlocks(lines: SourceLine[], file: string, scope: BlockScope): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].text.trim() === '') {
      index += 1;
      continue;
    }
    const parsed = parseBlock(lines, index, file, scope);
    blocks.push(parsed.block);
    if (parsed.next <= index) {
      parseFailure(
        file,
        lines[index].line,
        contentColumn(lines[index]),
        'markdown',
        'The parser could not advance.'
      );
    }
    index = parsed.next;
  }
  return blocks;
}

function matchListMarker(text: string): {
  indent: number;
  ordered: boolean;
  startNumber?: number;
  contentColumn: number;
  rest: string;
} | null {
  const unordered = text.match(/^(\s*)([-+*])([ \t]+)(.*)$/);
  if (unordered) {
    return {
      indent: unordered[1].length,
      ordered: false,
      contentColumn: unordered[1].length + unordered[2].length + unordered[3].length,
      rest: unordered[4],
    };
  }
  const ordered = text.match(/^(\s*)(\d{1,9})([.)])([ \t]+)(.*)$/);
  if (ordered) {
    return {
      indent: ordered[1].length,
      ordered: true,
      startNumber: Number(ordered[2]),
      contentColumn: ordered[1].length + ordered[2].length + ordered[3].length + ordered[4].length,
      rest: ordered[5],
    };
  }
  return null;
}

function parseList(
  lines: SourceLine[],
  start: number,
  file: string,
  scope: BlockScope
): { block: Block; next: number } {
  const first = matchListMarker(lines[start].text);
  if (!first) {
    parseFailure(
      file,
      lines[start].line,
      contentColumn(lines[start]),
      'markdown',
      'Expected a list item.'
    );
  }
  const items: ListItem[] = [];
  let index = start;
  while (index < lines.length) {
    if (lines[index].text.trim() === '') {
      const next = nextNonBlank(lines, index + 1);
      if (next === -1) {
        break;
      }
      const marker = matchListMarker(lines[next].text);
      if (marker && marker.indent === first.indent && marker.ordered === first.ordered) {
        index = next;
        continue;
      }
      if (leadingSpaces(lines[next].text) > first.indent) {
        index += 1;
        continue;
      }
      break;
    }
    const marker = matchListMarker(lines[index].text);
    if (!marker || marker.indent !== first.indent || marker.ordered !== first.ordered) {
      break;
    }
    const itemLines: SourceLine[] = [
      {
        line: lines[index].line,
        column: lines[index].column + (lines[index].text.length - marker.rest.length),
        text: marker.rest,
      },
    ];
    index += 1;
    while (index < lines.length) {
      const look = lines[index];
      if (look.text.trim() === '') {
        const next = nextNonBlank(lines, index + 1);
        if (next === -1) {
          break;
        }
        const nextMarker = matchListMarker(lines[next].text);
        if (nextMarker && nextMarker.indent <= first.indent) {
          break;
        }
        if (leadingSpaces(lines[next].text) <= first.indent) {
          break;
        }
        itemLines.push(look);
        index += 1;
        continue;
      }
      const inner = matchListMarker(look.text);
      if (inner && inner.indent === first.indent && inner.ordered === first.ordered) {
        break;
      }
      if (leadingSpaces(look.text) < marker.contentColumn && look.text.trim() !== '') {
        break;
      }
      const stripped = stripIndent(look.text, marker.contentColumn);
      itemLines.push({
        line: look.line,
        column: look.column + stripped.removed,
        text: stripped.text,
      });
      index += 1;
    }
    items.push({ children: parseBlocks(itemLines, file, scope) });
  }
  return {
    block: {
      type: 'list',
      ordered: first.ordered,
      ...(first.ordered ? { start: first.startNumber } : {}),
      items,
    },
    next: index,
  };
}

function isTableStart(lines: SourceLine[], start: number): boolean {
  if (start + 1 >= lines.length || !lines[start].text.includes('|')) {
    return false;
  }
  const header = splitTableRow(lines[start].text);
  const separator = parseSeparator(lines[start + 1].text);
  return separator !== null && separator.length === header.length && header.length > 0;
}

function parseTable(
  lines: SourceLine[],
  start: number,
  file: string
): { block: Block; next: number } {
  const headerCells = splitTableRow(lines[start].text);
  const align = parseSeparator(lines[start + 1].text) ?? [];
  const rows: Inline[][][] = [];
  let index = start + 2;
  while (
    index < lines.length &&
    lines[index].text.includes('|') &&
    lines[index].text.trim() !== ''
  ) {
    if (isThematicBreak(lines[index].text) || /^\s{0,3}#{1,6}\s/.test(lines[index].text)) {
      break;
    }
    const cells = splitTableRow(lines[index].text);
    rows.push(
      headerCells.map((_, cellIndex) => {
        const cell = cells[cellIndex];
        return parseInline(
          cell?.text ?? '',
          file,
          lines[index].line,
          lines[index].column + (cell?.offset ?? 0)
        );
      })
    );
    index += 1;
  }
  return {
    block: {
      type: 'table',
      align,
      header: headerCells.map((cell) =>
        parseInline(cell.text, file, lines[start].line, lines[start].column + cell.offset)
      ),
      rows,
    },
    next: index,
  };
}

function splitTableRow(text: string): { text: string; offset: number }[] {
  const cells: { text: string; offset: number }[] = [];
  let index = 0;
  while (text[index] === ' ') {
    index += 1;
  }
  if (text[index] === '|') {
    index += 1;
  }
  let current = '';
  let segmentStart = index;
  let endedOnSeparator = false;
  const push = () => {
    const leading = current.length - current.trimStart().length;
    cells.push({ text: current.trim(), offset: segmentStart + leading });
  };
  while (index < text.length) {
    if (text[index] === '\\' && text[index + 1] === '|') {
      current += '|';
      index += 2;
      endedOnSeparator = false;
      continue;
    }
    if (text[index] === '`') {
      const span = readCodeSpan(text, index);
      if (span) {
        current += text.slice(index, span.next);
        index = span.next;
        endedOnSeparator = false;
        continue;
      }
    }
    if (text[index] === '|') {
      push();
      current = '';
      index += 1;
      segmentStart = index;
      endedOnSeparator = true;
      continue;
    }
    current += text[index];
    index += 1;
    endedOnSeparator = false;
  }
  if (!endedOnSeparator) {
    push();
  }
  return cells;
}

function parseSeparator(text: string): TableAlign[] | null {
  if (!text.includes('-') || (!text.includes('|') && !/^[\s|:-]+$/.test(text))) {
    return null;
  }
  const cells = splitTableRow(text).map((cell) => cell.text);
  if (cells.length === 0) {
    return null;
  }
  const align: TableAlign[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) {
      return null;
    }
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    align.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return align;
}

function parseParagraph(
  lines: SourceLine[],
  start: number,
  file: string
): { block: Block; next: number } {
  const chunks: Inline[] = [];
  const take = (lineIndex: number) => {
    const column = contentColumn(lines[lineIndex]);
    const inlines = parseInline(lines[lineIndex].text.trim(), file, lines[lineIndex].line, column);
    if (chunks.length > 0) {
      chunks.push({ type: 'text', value: ' ' });
    }
    chunks.push(...inlines);
  };
  take(start);
  let index = start + 1;
  while (index < lines.length && lines[index].text.trim() !== '') {
    const underline = setextDepth(lines[index].text);
    if (underline) {
      return { block: { type: 'heading', depth: underline, children: chunks }, next: index + 1 };
    }
    if (startsBlock(lines, index)) {
      break;
    }
    take(index);
    index += 1;
  }
  return { block: { type: 'paragraph', children: chunks }, next: index };
}

function startsBlock(lines: SourceLine[], index: number): boolean {
  const text = lines[index].text;
  return (
    /^\s{0,3}#{1,6}(?:\s|$)/.test(text) ||
    isFence(text) ||
    isThematicBreak(text) ||
    /^\s{0,3}>/.test(text) ||
    matchListMarker(text) !== null ||
    /^\s*<Story\b/.test(text) ||
    /^\s*<\/?[A-Za-z!]/.test(text) ||
    /^\s*<!--/.test(text) ||
    isImportStart(text) ||
    isExportStart(text) ||
    isLinkReferenceDefinition(text) ||
    isTableStart(lines, index)
  );
}

function setextDepth(text: string): 1 | 2 | null {
  if (/^\s{0,3}=\s*$|^\s{0,3}=+\s*$/.test(text) && /^=+$/.test(text.trim())) {
    return 1;
  }
  if (/^-+$/.test(text.trim()) && text.trim().length >= 1 && /^\s{0,3}-+\s*$/.test(text)) {
    return 2;
  }
  return null;
}

function nextNonBlank(lines: SourceLine[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].text.trim() !== '') {
      return index;
    }
  }
  return -1;
}

function leadingSpaces(text: string): number {
  return text.match(/^ */)?.[0].length ?? 0;
}

function stripIndent(text: string, count: number): { text: string; removed: number } {
  let removed = 0;
  while (removed < text.length && removed < count && text[removed] === ' ') {
    removed += 1;
  }
  return { text: text.slice(removed), removed };
}

function parseInline(text: string, file: string, line: number, column: number): Inline[] {
  return resolveEmphasis(tokenizeInline(text, file, line, column)).map(tokenToInline);
}

function tokenToInline(token: InlineTok): Inline {
  if (token.type === 'delim') {
    return { type: 'text', value: token.marker.repeat(token.count) };
  }
  if (token.type === 'text') {
    return { type: 'text', value: token.value };
  }
  if (token.type === 'code') {
    return { type: 'inlineCode', value: token.value };
  }
  if (token.type === 'image') {
    return {
      type: 'image',
      alt: token.alt,
      url: token.url,
      ...(token.title ? { title: token.title } : {}),
    };
  }
  if (token.type === 'link') {
    return {
      type: 'link',
      url: token.url,
      ...(token.title ? { title: token.title } : {}),
      children: resolveEmphasis(token.children).map(tokenToInline),
    };
  }
  if (token.type === 'em') {
    return { type: 'emphasis', children: token.children.map(tokenToInline) };
  }
  return { type: 'strong', children: token.children.map(tokenToInline) };
}

function tokenizeInline(text: string, file: string, line: number, column: number): InlineTok[] {
  const tokens: InlineTok[] = [];
  let index = 0;
  let plain = '';
  const flush = () => {
    if (plain !== '') {
      tokens.push({ type: 'text', value: plain });
      plain = '';
    }
  };
  const failAt = (offset: number, construct: string, message: string): never =>
    parseFailure(file, line, column + offset, construct, message);

  while (index < text.length) {
    const char = text[index];
    if (char === '\\' && index + 1 < text.length) {
      plain += text[index + 1];
      index += 2;
      continue;
    }
    if (char === '`') {
      flush();
      const code = readCodeSpan(text, index);
      if (!code) {
        return failAt(index, 'code', 'This inline code span never closes.');
      }
      tokens.push({ type: 'code', value: code.value });
      index = code.next;
      continue;
    }
    if (char === '!' && text[index + 1] === '[') {
      flush();
      const image = readImage(text, index, failAt);
      tokens.push(image.token);
      index = image.next;
      continue;
    }
    if (char === '<') {
      const autolink = readAutolink(text, index);
      if (autolink) {
        flush();
        tokens.push(autolink.token);
        index = autolink.next;
        continue;
      }
      if (isTagAngle(text, index)) {
        flush();
        return failAt(
          index,
          /^<https?:|^<mailto:/i.test(text.slice(index))
            ? 'url'
            : text[index + 1] === '/' || /[a-z!]/.test(text[index + 1] ?? '')
              ? 'html'
              : 'component',
          'Raw HTML is not allowed. Markdown images and links are.'
        );
      }
      plain += char;
      index += 1;
      continue;
    }
    if (char === '[') {
      const close = findClosingBracket(text, index);
      const after = close === -1 ? '' : (text[close + 1] ?? '');
      if (close !== -1 && after === '(') {
        flush();
        const link = readLink(text, index, file, line, column);
        tokens.push(link.token);
        index = link.next;
        continue;
      }
      if (close !== -1 && after === '[') {
        flush();
        return failAt(
          index,
          'markdown',
          'Reference-style links are not supported. Use [text](url).'
        );
      }
      plain += char;
      index += 1;
      continue;
    }
    if (char === '{') {
      failAt(
        index,
        'expression',
        'JavaScript expressions are not allowed outside of={Module.Story}.'
      );
    }
    if (char === '*' || char === '_') {
      flush();
      let next = index + 1;
      while (text[next] === char) {
        next += 1;
      }
      const count = next - index;
      const flags = flanking(text, index, count, char);
      tokens.push({ type: 'delim', marker: char, count, ...flags });
      index = next;
      continue;
    }
    plain += char;
    index += 1;
  }
  flush();
  return tokens;
}

function flanking(text: string, start: number, count: number, marker: string) {
  const before = start === 0 ? ' ' : text[start - 1];
  const after = start + count >= text.length ? ' ' : text[start + count];
  const isSpace = (char: string) => /\s/.test(char);
  const isPunct = (char: string) => /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(char);
  const left = !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
  const right = !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));
  let canOpen = left;
  let canClose = right;
  if (marker === '_') {
    if (canOpen && /[A-Za-z0-9]/.test(before)) {
      canOpen = false;
    }
    if (canClose && /[A-Za-z0-9]/.test(after)) {
      canClose = false;
    }
  }
  return { canOpen, canClose };
}

function readCodeSpan(text: string, start: number): { value: string; next: number } | undefined {
  let ticks = 0;
  while (text[start + ticks] === '`') {
    ticks += 1;
  }
  const close = text.indexOf('`'.repeat(ticks), start + ticks);
  if (close === -1) {
    return undefined;
  }
  let value = text.slice(start + ticks, close);
  if (value.startsWith(' ') && value.endsWith(' ') && value.trim() !== '') {
    value = value.slice(1, -1);
  }
  return { value, next: close + ticks };
}

function readImage(
  text: string,
  start: number,
  failAt: (offset: number, construct: string, message: string) => never
): { token: InlineTok; next: number } {
  const closeAlt = text.indexOf(']', start + 2);
  if (closeAlt === -1 || text[closeAlt + 1] !== '(') {
    failAt(start, 'image', 'This image is missing a destination. Use ![alt](url).');
  }
  const alt = text.slice(start + 2, closeAlt);
  if (alt.includes('<') || alt.includes('{')) {
    failAt(
      start + 2,
      alt.includes('{') ? 'expression' : 'html',
      'Image alt text must be plain text.'
    );
  }
  const destination = readDestination(text, closeAlt + 1, failAt);
  return {
    token: {
      type: 'image',
      alt,
      url: destination.url,
      ...(destination.title ? { title: destination.title } : {}),
    },
    next: destination.next,
  };
}

function readLink(
  text: string,
  start: number,
  file: string,
  line: number,
  column: number
): { token: InlineTok; next: number } {
  const close = findClosingBracket(text, start);
  if (close === -1 || text[close + 1] !== '(') {
    parseFailure(file, line, column + start, 'markdown', 'This link is missing a destination.');
  }
  const label = text.slice(start + 1, close);
  const destination = readDestination(text, close + 1, (offset, construct, message) => {
    parseFailure(file, line, column + offset, construct, message);
  });
  return {
    token: {
      type: 'link',
      url: destination.url,
      ...(destination.title ? { title: destination.title } : {}),
      children: tokenizeInline(label, file, line, column + start + 1),
    },
    next: destination.next,
  };
}

function findClosingBracket(text: string, start: number): number {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '\\') {
      index += 1;
      continue;
    }
    if (text[index] === '[') {
      depth += 1;
    } else if (text[index] === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function readDestination(
  text: string,
  open: number,
  failAt: (offset: number, construct: string, message: string) => never
): { url: string; title?: string; next: number } {
  let index = open + 1;
  while (text[index] === ' ') {
    index += 1;
  }
  let url = '';
  if (text[index] === '<') {
    const close = text.indexOf('>', index + 1);
    if (close === -1) {
      failAt(index, 'url', 'This destination never closes.');
    }
    url = text.slice(index + 1, close);
    index = close + 1;
  } else {
    let depth = 0;
    while (index < text.length && text[index] !== ')' && !(text[index] === ' ' && depth === 0)) {
      if (text[index] === '\\') {
        url += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (text[index] === '(') {
        depth += 1;
      } else if (text[index] === ')') {
        depth -= 1;
      }
      url += text[index];
      index += 1;
    }
  }
  let title: string | undefined;
  if (text[index] === ' ') {
    while (text[index] === ' ') {
      index += 1;
    }
    const quote = text[index];
    if (quote === '"' || quote === "'") {
      const close = text.indexOf(quote, index + 1);
      if (close === -1) {
        failAt(index, 'url', 'This link title never closes.');
      }
      title = text.slice(index + 1, close);
      index = close + 1;
    }
  }
  while (text[index] === ' ') {
    index += 1;
  }
  if (text[index] !== ')') {
    failAt(open, 'url', 'This destination never closes.');
  }
  assertSafeUrl(url, open, failAt);
  return { url, ...(title ? { title } : {}), next: index + 1 };
}

function readAutolink(text: string, start: number): { token: InlineTok; next: number } | undefined {
  const match = text.slice(start).match(/^<(https?:\/\/[^>\s]+|mailto:[^>\s]+)>/i);
  if (!match) {
    return undefined;
  }
  return {
    token: { type: 'link', url: match[1], children: [{ type: 'text', value: match[1] }] },
    next: start + match[0].length,
  };
}

function assertSafeUrl(
  url: string,
  offset: number,
  failAt: (offset: number, construct: string, message: string) => never
) {
  // The URL parser drops tab, CR, and LF, then leading C0 controls, before the scheme.
  const scheme = url
    .replace(/[\t\n\r]/g, '')
    .replace(/^[\u0000-\u001f ]+/, '')
    .toLowerCase();
  if (
    scheme.startsWith('javascript:') ||
    scheme.startsWith('vbscript:') ||
    scheme.startsWith('data:')
  ) {
    failAt(offset, 'url', `The URL protocol in "${url}" is not allowed.`);
  }
}

function resolveEmphasis(tokens: InlineTok[]): InlineTok[] {
  const stack: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== 'delim' || token.count === 0) {
      continue;
    }
    if (token.canClose) {
      for (let slot = stack.length - 1; slot >= 0; slot -= 1) {
        const openIndex = stack[slot];
        const opener = tokens[openIndex];
        if (opener.type !== 'delim' || opener.marker !== token.marker || !opener.canOpen) {
          continue;
        }
        if (opener.count < 1 || token.count < 1) {
          continue;
        }
        const consumed = opener.count >= 2 && token.count >= 2 ? 2 : 1;
        const before = tokens.slice(0, openIndex);
        const inner = resolveEmphasis(tokens.slice(openIndex + 1, index));
        const after = tokens.slice(index + 1);
        const wrapped: InlineTok =
          consumed === 2 ? { type: 'strong', children: inner } : { type: 'em', children: inner };
        const openRemain = opener.count - consumed;
        const closeRemain = token.count - consumed;
        return resolveEmphasis([
          ...before,
          ...(openRemain > 0 ? [{ ...opener, count: openRemain }] : []),
          wrapped,
          ...(closeRemain > 0 ? [{ ...token, count: closeRemain }] : []),
          ...after,
        ]);
      }
    }
    if (token.canOpen) {
      stack.push(index);
    }
  }
  return tokens.flatMap((token) => {
    if (token.type !== 'delim') {
      return [token];
    }
    if (token.count === 0) {
      return [];
    }
    return [{ type: 'text' as const, value: token.marker.repeat(token.count) }];
  });
}
