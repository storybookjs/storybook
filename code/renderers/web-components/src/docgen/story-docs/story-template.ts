import { type NodePath, types as t } from 'storybook/internal/babel';
import { collectImportBindings, isOperand } from 'storybook/internal/csf-tools';
import {
  asOperand,
  dedentStoryCode,
  defaultWord,
  hasHoleBracket,
  hole,
  holeWord,
} from 'storybook/internal/docs-tools';

import { TEMPLATE_TAG_SOURCES } from './template-scope.ts';

/**
 * A story's template, and the names its code reads that the snippet does not declare: a name the
 * render declares where the template leaves it out, such as `args` in a write `args.count++`, and
 * a name of the module a parameter default reads.
 */
export interface LiveTemplate {
  template: string;
  free: string[];
}

type RenderPath = NodePath<t.Function>;
type Scope = NodePath['scope'];

interface Edit {
  start: number;
  end: number;
  text: string;
}

// Where an expression of a lit template sits in its html, when it is a whole binding or value.
interface Slot {
  kind: 'attr' | 'bool' | 'prop' | 'listener' | 'quoted' | 'text' | 'raw';
  name: string;
  quote: string;
  start: number;
  end: number;
}

/** Whether a name is declared by an import from lit, which a lit snippet has. */
export const isLitImport = (declared: NodePath | undefined) =>
  !!declared?.parentPath?.isImportDeclaration() &&
  TEMPLATE_TAG_SOURCES.includes(declared.parentPath.node.source.value);

// A name lit reads whole as an attribute or property in a tag.
const NAME = /^[^\s"'<>/=`$\\{}⟦⟧]+$/;

/**
 * The story's render as written, with a hole wherever it reads an arg: the html when it returns a
 * lit template, else its code. The story context is no arg, so a read of it stays as written. It
 * is `undefined` when the story reads its args in a way no hole stands for.
 */
export function litTemplate(
  render: RenderPath,
  args: Record<string, t.Node> = {}
): LiveTemplate | undefined {
  const program = render.findParent((path) => path.isProgram()) as NodePath<t.Program>;
  const { code } = (program.hub as unknown as { file: { code: string } }).file;
  const bindings = collectImportBindings(program);
  const [param] = render.get('params');
  if (!param || hasHoleBracket(code)) {
    return undefined;
  }
  const isLit = (tag: t.Node, scope: Scope) =>
    t.isIdentifier(tag) &&
    scope.getBinding(tag.name)?.kind === 'module' &&
    TEMPLATE_TAG_SOURCES.includes(bindings.get(tag.name)?.importId ?? '') &&
    bindings.get(tag.name)?.importName === 'html';
  // Every expression of a lit template in the render, with where it sits in the html.
  const slots = new Map<t.Node, Slot>();
  render.traverse({
    TaggedTemplateExpression(path) {
      if (isLit(path.node.tag, path.scope)) {
        htmlSlots(path.node.quasi, slots);
      }
    },
  });
  const target = param.isAssignmentPattern() ? param.get('left') : param;
  const found = argEdits(target, code, (read) => slots.get(read.node), args);
  if (!found || found.edits.length === 0) {
    return undefined;
  }
  // A body that only takes args apart and returns lit html is written as that html.
  const body = render.get('body');
  const statements = body.isBlockStatement() ? body.get('body') : [];
  const last = body.isBlockStatement() ? statements.at(-1) : body;
  const returned = last?.isReturnStatement() ? last.get('argument') : last;
  const html =
    returned?.isTaggedTemplateExpression() &&
    isLit(returned.node.tag, returned.scope) &&
    statements.slice(0, -1).every((statement) => found.removed.has(statement.node))
      ? returned.node.quasi
      : undefined;
  const [start, end] = html
    ? [html.start! + 1, html.end! - 1]
    : body.isBlockStatement()
      ? [body.node.start! + 1, body.node.end! - 1]
      : [body.node.start!, body.node.end!];
  let text = code.slice(start, end);
  const edits = found.edits.filter((edit) => edit.start >= start && edit.end <= end);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start - start) + edit.text + text.slice(edit.end - start);
  }
  if (!hasHoleBracket(text)) {
    return undefined;
  }
  // Html or a block starts after its backtick or brace, mostly on a new line whose indentation the
  // others share; an expression where it is written.
  const column =
    html || body.isBlockStatement()
      ? /^\s*\n([ \t]*)/.exec(text)?.[1]!.length
      : body.node.loc!.start.column;
  // Whether the template leaves code out: code outside the cut, or that a hole stands for.
  const cut = (node: t.Node) =>
    node.start! < start ||
    node.end! > end ||
    edits.some((edit) => edit.start <= node.start! && node.end! <= edit.end);
  const free = new Set(found.free);
  render.traverse({
    ReferencedIdentifier(path) {
      const declared = path.scope.getBinding(path.node.name);
      if (declared?.path.isDescendant(render) && cut(declared.identifier) && !cut(path.node)) {
        free.add(path.node.name);
      }
    },
  });
  return { template: dedentStoryCode(text.trim(), column), free: [...free] };
}

// The expressions of a lit template, each with where it sits in the html.
function htmlSlots(quasi: t.TemplateLiteral, slots: Map<t.Node, Slot>): void {
  const raws = quasi.quasis.map((item) => item.value.raw);
  const state: HtmlState = { in: 'text', tag: '' };
  readHtml(state, raws[0]!);
  for (const [index, expression] of quasi.expressions.entries()) {
    const [before, after] = [raws[index]!, raws[index + 1]!];
    const [start, end] = [quasi.quasis[index]!.end!, quasi.quasis[index + 1]!.start!];
    const inTag = state.in !== 'text' && !state.raw;
    // `name=${…}`, `name="${…}"`, `?name=${…}`, `.name=${…}` or `@name=${…}`.
    const binding = inTag ? /(?<=\s)([?@.]?)([^\s"'<>/=.?@][^\s"'<>/=]*)=("?)$/.exec(before) : null;
    const quote = binding?.[3] ?? '';
    const whole = binding && (quote ? after.startsWith(quote) : /^(\s|\/?>)/.test(after));
    if (binding && whole && NAME.test(binding[2]!)) {
      const prefix = binding[1]!;
      const kind = ({ '?': 'bool', '.': 'prop', '@': 'listener' } as const)[prefix] ?? 'attr';
      slots.set(expression, {
        kind,
        name: binding[2]!,
        quote,
        start: start - binding[0].length,
        end: end + quote.length,
      });
    } else if (state.in === '"' || state.in === "'" || !inTag) {
      const kind = inTag ? 'quoted' : state.raw ? 'raw' : 'text';
      slots.set(expression, { kind, name: '', quote: state.in, start, end });
    }
    readHtml(state, after);
  }
}

interface Found {
  edits: Edit[];
  removed: Set<t.Node>;
  free: string[];
}

// An edit per arg read, or `undefined` when one is not a hole.
function argEdits(
  param: NodePath,
  code: string,
  slotFor: (read: NodePath) => Slot | undefined,
  args: Record<string, t.Node>
): Found | undefined {
  const found: Found = { edits: [], removed: new Set(), free: [] };
  let ok = true;
  const add = (edit: Edit | undefined) => {
    ok &&= edit !== undefined;
    if (edit) {
      found.edits.push(edit);
    }
  };
  // A listener binding stays as written, as no control sets a listener.
  const inListener = (read: NodePath) => !!read.find((path) => slotFor(path)?.kind === 'listener');
  const read = (path: NodePath, arg: string, fallback: string) => {
    // The target of a write, as in `args.count++`, is no read and stays as written.
    if (!isWritten(path) && !inListener(path)) {
      add(
        readEdit(
          path,
          arg,
          fallback,
          slotFor(path),
          Object.hasOwn(args, arg) ? args[arg] : undefined
        )
      );
    }
  };

  // The reads of a name that holds every arg but `omitted`: the parameter, or a `...rest`.
  const objectReads = (scope: Scope, name: string, omitted: string[]) => {
    for (const reference of referencesOf(scope, name) ?? [undefined]) {
      if (!reference) {
        return add(undefined);
      }
      const parent = reference.parentPath!;
      if (t.isMemberExpression(parent.node, { object: reference.node }) && isWritten(parent)) {
        continue;
      }
      const arg = memberName(parent, reference.node);
      if (arg !== undefined) {
        if (omitted.includes(arg)) {
          add(undefined);
        } else {
          read(parent, arg, '');
        }
        continue;
      }
      const declaration = ownDeclaration(parent);
      if (declaration && (parent.get('id') as NodePath).isObjectPattern()) {
        patternReads(parent.get('id') as NodePath, omitted);
        found.edits.push(removeEdit(declaration, code));
        found.removed.add(declaration);
      } else if (!inListener(reference)) {
        add(wholeEdit(reference, omitted));
      }
    }
  };

  // `{ label, size = 'md', ...rest }`, taken from an object that holds every arg but `omitted`.
  const patternReads = (pattern: NodePath, omitted: string[]) => {
    if (!pattern.isObjectPattern()) {
      return add(undefined);
    }
    const taken: string[] = [];
    for (const property of pattern.get('properties')) {
      if (property.isRestElement()) {
        const { argument } = property.node;
        if (t.isIdentifier(argument)) {
          objectReads(pattern.scope, argument.name, [...omitted, ...taken]);
        } else {
          add(undefined);
        }
        continue;
      }
      const { key, value, computed } = property.node as t.ObjectProperty;
      const arg = t.isIdentifier(key) ? key.name : t.isStringLiteral(key) ? key.value : undefined;
      const local = t.isAssignmentPattern(value) ? value.left : value;
      const fallback = t.isAssignmentPattern(value)
        ? fallbackCode(property.get('value.right') as NodePath<t.Expression>, pattern, code, found)
        : '';
      const references = t.isIdentifier(local) && referencesOf(pattern.scope, local.name);
      if (
        computed ||
        arg === undefined ||
        omitted.includes(arg) ||
        fallback === undefined ||
        !references
      ) {
        return add(undefined);
      }
      taken.push(arg);
      for (const reference of references) {
        const shorthand = reference.parentPath;
        if (shorthand?.isObjectProperty() && shorthand.node.shorthand && !inListener(reference)) {
          add(nodeEdit(shorthand.node, `${arg}: ${argHole('value', [arg], fallback)}`));
        } else {
          read(reference, arg, fallback);
        }
      }
    }
  };

  if (param.isIdentifier()) {
    objectReads(param.scope, param.node.name, []);
  } else {
    patternReads(param, []);
  }
  return ok ? found : undefined;
}

// A lit binding or html text for a read that is a whole slot, or `⟦value⟧` or `⟦operand⟧` in code.
function readEdit(
  read: NodePath,
  arg: string,
  fallback: string,
  slot: Slot | undefined,
  written?: t.Node
): Edit {
  if (!slot) {
    return startsOperand(read, written)
      ? nodeEdit(read.node, argHole('operand', [arg], fallback && asOperand(fallback)))
      : nodeEdit(read.node, argHole('value', [arg], fallback));
  }
  const { kind, name, quote, start, end } = slot;
  // A whole attribute value is written in quotes, as its text.
  if (kind === 'attr' || kind === 'quoted') {
    const words = [arg, ...(quote === "'" ? ["'"] : [])];
    const text = argHole('quoted', words, fallback && `\${${fallback}}`);
    return { start, end, text: kind === 'attr' ? `${name}="${text}"` : text };
  }
  const named = kind === 'bool' || kind === 'prop';
  const prefix = kind === 'bool' ? '?' : '.';
  const unset = fallback ? `${named ? `${prefix}${name}=` : ''}\${${fallback}}` : '';
  return { start, end, text: argHole(kind, [...(named ? [name] : []), arg], unset) };
}

// The args passed along whole, as in `${spread(args)}`: the object they are, as a literal.
function wholeEdit(read: NodePath, omitted: string[]): Edit | undefined {
  const { node, parentPath: parent } = read;
  if (!read.isIdentifier() || !parent || parent.isTSTypeQuery()) {
    return undefined;
  }
  const literal = hole('args', ...omitted.map((name) => holeWord(`-${name}`)));
  if (parent.isObjectProperty() && parent.node.shorthand) {
    return nodeEdit(parent.node, `${read.node.name}: ${literal}`);
  }
  return nodeEdit(node, startsOperand(read) ? `(${literal})` : literal);
}

// The places a name is read.
const referencesOf = (scope: Scope, name: string) => scope.getBinding(name)?.referencePaths;

// The arg `args.label` or `args['label']` reads.
function memberName(member: NodePath, object: t.Node): string | undefined {
  if (!member.isMemberExpression() && !member.isOptionalMemberExpression()) {
    return undefined;
  }
  const { property, computed } = member.node;
  if (member.node.object !== object) {
    return undefined;
  }
  return !computed && t.isIdentifier(property)
    ? property.name
    : computed && t.isStringLiteral(property)
      ? property.value
      : undefined;
}

// The statement of `const { label, ...rest } = args;`, which the template can leave out.
function ownDeclaration(declarator: NodePath): t.Node | undefined {
  const declaration = declarator.parentPath;
  return declarator.isVariableDeclarator() &&
    declaration?.isVariableDeclaration() &&
    declaration.node.declarations.length === 1 &&
    declaration.parentPath.isBlockStatement()
    ? declaration.node
    : undefined;
}

// A statement, with its line when it has that to itself.
function removeEdit(statement: t.Node, code: string): Edit {
  const line = code.lastIndexOf('\n', statement.start! - 1) + 1;
  const after = /^[ \t]*\n?/.exec(code.slice(statement.end!))![0];
  const ownLine = !code.slice(line, statement.start!).trim() && after.endsWith('\n');
  return {
    start: ownLine ? line : statement.start!,
    end: statement.end! + (ownLine ? after.length : after.trimEnd().length),
    text: '',
  };
}

// The code of a default, as in `{ size = 'md' }`, to write wherever the arg is read; `undefined` for
// one that reads the story's own names, or is not the same value at each read, such as a call. The
// names it reads from outside the story, such as `SIZES` in `SIZES.md`, are `free` in the snippet.
function fallbackCode(
  fallback: NodePath<t.Expression>,
  pattern: NodePath,
  code: string,
  { free }: Found
): string | undefined {
  const story = pattern.getFunctionParent()!;
  let inlinable = true;
  const visit = (path: NodePath) => {
    if (
      path.isCallExpression() ||
      path.isOptionalCallExpression() ||
      path.isNewExpression() ||
      path.isTaggedTemplateExpression() ||
      path.isAssignmentExpression() ||
      path.isUpdateExpression() ||
      path.isAwaitExpression() ||
      path.isYieldExpression() ||
      path.isSequenceExpression()
    ) {
      inlinable = false;
    }
    if (path.isReferencedIdentifier()) {
      const declared = path.scope.getBinding(path.node.name)?.path;
      const within = ({ node }: NodePath) => declared?.findParent((parent) => parent.node === node);
      inlinable &&= !within(story) || !!within(fallback);
      if (declared && !within(story) && !isLitImport(declared)) {
        free.push(path.node.name);
      }
    }
  };
  visit(fallback);
  fallback.traverse({ enter: visit });
  const written = code.slice(fallback.node.start!, fallback.node.end!);
  const { node } = fallback;
  const atom =
    t.isLiteral(node) ||
    t.isIdentifier(node) ||
    t.isMemberExpression(node) ||
    t.isArrayExpression(node) ||
    t.isObjectExpression(node);
  return !inlinable ? undefined : atom ? written : `(${written})`;
}

const isWritten = ({ node, parent }: NodePath) =>
  t.isAssignmentExpression(parent, { left: node }) ||
  t.isUpdateExpression(parent) ||
  t.isUnaryExpression(parent, { operator: 'delete' });

const startsOperand = (read: NodePath, written?: t.Node) =>
  isOperand(
    read.node,
    read
      .getAncestry()
      .slice(1)
      .map((path) => path.node),
    written
  );

// A hole for one arg, with the code the story defaults it to while it is unset.
const argHole = (kind: string, words: string[], fallback: string) =>
  hole(kind, ...words.map(holeWord), ...(fallback ? [defaultWord(fallback)] : []));

const nodeEdit = (node: t.Node, text: string): Edit => ({
  start: node.start!,
  end: node.end!,
  text,
});

/**
 * Where html written so far stands: in text, in a tag with the `tag` text read of it, or in the
 * text of the `<style>` or `<script>` that `raw` names, which is no html.
 */
interface HtmlState {
  in: 'text' | 'tag' | '"' | "'";
  tag: string;
  raw?: string;
}

function readHtml(state: HtmlState, html: string): void {
  for (let index = 0; index < html.length; index++) {
    const char = html[index]!;
    if (state.raw) {
      if (char === '<' && html.slice(index + 2, index + 2 + state.raw.length) === state.raw) {
        state.raw = undefined;
        state.in = 'tag';
        state.tag = char;
      }
      continue;
    }
    if (state.in === 'text') {
      if (char === '<' && /[a-zA-Z/]/.test(html[index + 1] ?? '')) {
        state.in = 'tag';
        state.tag = char;
      }
      continue;
    }
    if (state.in === 'tag' && char === '>') {
      const name = /^<([a-zA-Z][^\s/>]*)/.exec(state.tag)?.[1]?.toLowerCase();
      state.raw = name === 'style' || name === 'script' ? name : undefined;
      state.in = 'text';
      state.tag = '';
      continue;
    }
    if (state.in === 'tag' && (char === '"' || char === "'")) {
      state.in = char;
    } else if (char === state.in) {
      state.in = 'tag';
    }
    state.tag += char;
  }
}
