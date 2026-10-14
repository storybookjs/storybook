import { type NodePath, types as t } from 'storybook/internal/babel';
import { isOperand } from 'storybook/internal/csf-tools';
import {
  asOperand,
  dedentStoryCode,
  defaultWord,
  hasHoleBracket,
  hole,
  holeWord,
} from 'storybook/internal/docs-tools';
import type { StrictArgTypes } from 'storybook/internal/types';

import { parseArgKey } from '../../arg-keys.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { classifyArg } from './classify-args.ts';
import { type TemplateModule, litBindings } from './template-calls.ts';

/** The component's element and, where known, its manifest declaration. */
export interface SpreadElement {
  tag: string;
  declaration?: ManifestDeclaration;
}

/**
 * A story's template; the listeners it leaves out, and the args they read; and the names its code
 * reads that the snippet neither declares nor imports, but for lit's own.
 */
export interface LiveTemplate {
  template: string;
  listeners: string[];
  heard: string[];
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
  tag: string;
  start: number;
  end: number;
}

/**
 * `<tag ⟦props …⟧></tag>` for a story without a render function: each arg as Storybook's render
 * applies it, an attribute, property or custom property in the tag, a slot as content, and a part
 * or state style in a `<style>` before it. Any other arg the story gets at runtime, such as one
 * only its argTypes name, is set as a property, by the `*` word. An arg whose name the snippet
 * cannot write, or that sets what another arg sets already, gets a `^arg` word: the snippet cannot
 * show it while it is set.
 */
export function argsTemplate(
  tag: string,
  storyArgs: string[],
  argTypes: StrictArgTypes,
  declaration: ManifestDeclaration
): string {
  const props: string[] = [];
  const styles: string[] = [];
  const slots: string[] = [];
  const taken = new Set<string>();
  // The word of an arg, or its `^arg` word where the name cannot be written or is taken.
  const word = (arg: string, target: string, valid: RegExp, text: string) => {
    const ok = valid.test(target.replace(/^[.:]+/, '')) && !taken.has(target);
    taken.add(target);
    return ok ? text : `^${arg}`;
  };
  for (const arg of new Set([...storyArgs, ...Object.keys(argTypes)])) {
    const binding = classifyArg(arg, false, argTypes, declaration);
    const parsed = binding.kind === 'unknown' ? parseArgKey(arg) : undefined;
    const kind = parsed ? CATEGORY_KINDS[parsed.category] : binding.kind;
    const name = parsed?.name ?? ('name' in binding ? binding.name : arg);
    const field = binding.kind === 'attribute' && binding.viaField ? '~' : '';
    switch (kind) {
      case 'attribute':
      case 'cssProperty':
        props.push(word(arg, name, NAME, `${field}${name}=${arg}`));
        break;
      case 'property':
      case 'unknown':
        props.push(word(arg, `.${name}`, NAME, `.${name}=${arg}`));
        break;
      case 'slot': {
        const slot = word(arg, `slot:${name}`, /^slot:[\w-]+$/, hole('slot', name, holeWord(arg)));
        // A `-arg` word keeps the `*` word from setting it as a property too.
        (slot.startsWith('^') ? props : slots).push(slot);
        props.push(`-${arg}`);
        break;
      }
      case 'cssPart':
      case 'cssState': {
        const selector = kind === 'cssPart' ? `::part(${name})` : `:state(${name})`;
        const rule = word(arg, selector, /^\w[\w-]*\(([\w-]+)\)$/, `${selector}=${arg}`);
        (rule.startsWith('^') ? props : styles).push(rule);
        props.push(`-${arg}`);
        break;
      }
      default:
        // A listener or a method, which the snippet leaves out.
        props.push(`-${arg}`);
        break;
    }
  }
  const style = styles.length > 0 ? hole('style', tag, ...styles.map(holeWord)) : '';
  const words = [...props, '*'].map(holeWord);
  return `${style}<${tag} ${hole('props', ...words)}>${slots.join('')}</${tag}>`;
}

// A name lit reads whole as an attribute or property in a tag.
const NAME = /^[^\s"'<>/=`$\\{}⟦⟧]+$/;

// The binding of an arg the manifest does not know, by the suffix Storybook's render reads.
const CATEGORY_KINDS = {
  cssProperties: 'cssProperty',
  slots: 'slot',
  cssParts: 'cssPart',
  cssStates: 'cssState',
  events: 'listener',
  methods: 'method',
} as const;

/**
 * The story's render as written, with a hole wherever it reads an arg: the html when it returns a
 * lit template, else its code. It is `undefined` when the story reads its args in a way no hole
 * stands for, such as writing to them.
 */
export function litTemplate(
  render: RenderPath,
  module: TemplateModule,
  element: SpreadElement
): LiveTemplate | undefined {
  const { code } = module;
  const [param, context] = render.get('params');
  if (!param || hasHoleBracket(code) || (context && readsAny(context))) {
    return undefined;
  }
  const lit = litBindings(module);
  const isLit = (tag: t.Node, scope: Scope) =>
    t.isIdentifier(tag) &&
    scope.getBinding(tag.name)?.kind === 'module' &&
    lit.get(tag.name)?.importId === 'lit' &&
    lit.get(tag.name)?.importName === 'html';
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
  const found = argEdits(target, code, (read) => slots.get(read.node), element);
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
  const free = new Set<string>();
  render.traverse({
    ReferencedIdentifier(path) {
      const binding = path.scope.getBinding(path.node.name);
      const kept = !edits.some(
        (edit) => edit.start <= path.node.start! && path.node.end! <= edit.end
      );
      const imported = lit.get(path.node.name)?.importId;
      if (
        kept &&
        path.node.start! >= start &&
        path.node.end! <= end &&
        binding?.scope.path.isProgram() &&
        !(imported && /^(lit|lit-html|lit-element|@lit\/[^/]+)(\/|$)/.test(imported))
      ) {
        free.add(path.node.name);
      }
    },
  });
  return {
    template: dedentStoryCode(text.trim(), column),
    listeners: found.listeners,
    heard: [...found.heard],
    free: [...free],
  };
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
    const tag = /^<([^\s/>]+)/.exec(state.tag)?.[1] ?? '';
    if (binding && whole && NAME.test(binding[2]!)) {
      const prefix = binding[1]!;
      const kind = ({ '?': 'bool', '.': 'prop', '@': 'listener' } as const)[prefix] ?? 'attr';
      const space = /\s*$/.exec(before.slice(0, -binding[0].length))![0].length;
      const from = start - binding[0].length - (kind === 'listener' ? space : 0);
      slots.set(expression, {
        kind,
        name: binding[2]!,
        quote,
        tag,
        start: from,
        end: end + quote.length,
      });
    } else if (state.in === '"' || state.in === "'" || !inTag) {
      const kind = inTag ? 'quoted' : state.raw ? 'raw' : 'text';
      slots.set(expression, { kind, name: '', quote: state.in, tag, start: start, end });
    }
    readHtml(state, after);
  }
}

const readsAny = (param: NodePath) =>
  Object.keys(param.getBindingIdentifiers()).some(
    (name) => param.scope.getBinding(name)?.referenced
  );

interface Found {
  edits: Edit[];
  removed: Set<t.Node>;
  listeners: string[];
  heard: Set<string>;
}

// An edit per arg read, or `undefined` when one is not a hole.
function argEdits(
  param: NodePath,
  code: string,
  slotFor: (read: NodePath) => Slot | undefined,
  element: SpreadElement
): Found | undefined {
  const found: Found = { edits: [], removed: new Set(), listeners: [], heard: new Set() };
  let ok = true;
  const add = (edit: Edit | undefined) => {
    ok &&= edit !== undefined;
    if (edit) {
      found.edits.push(edit);
    }
  };
  // A read inside a listener binding leaves the whole binding out, as no control sets a listener.
  const heard = (read: NodePath, arg: string) => {
    let path: NodePath | null = read;
    while (path && !slotFor(path)) {
      path = path.parentPath;
    }
    const slot = path && slotFor(path);
    if (slot?.kind !== 'listener') {
      return false;
    }
    found.heard.add(arg);
    if (!found.edits.some((edit) => edit.start === slot.start)) {
      found.listeners.push(slot.name);
      found.edits.push({ start: slot.start, end: slot.end, text: '' });
    }
    return true;
  };
  const read = (path: NodePath, arg: string, fallback: string) => {
    if (!heard(path, arg)) {
      add(readEdit(path, arg, fallback, slotFor(path), element));
    }
  };

  // The reads of a name that holds every arg but `omitted`: the parameter, or a `...rest`.
  const objectReads = (scope: Scope, name: string, omitted: string[]) => {
    for (const reference of referencesOf(scope, name) ?? [undefined]) {
      if (!reference) {
        return add(undefined);
      }
      const parent = reference.parentPath!;
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
      } else if (!heard(reference, name)) {
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
        ? fallbackCode(property.get('value.right') as NodePath<t.Expression>, pattern, code)
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
        if (shorthand?.isObjectProperty() && shorthand.node.shorthand) {
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

// A lit binding or html text for a read that is a whole slot, or `⟦value⟧` or `⟦operand⟧` in code;
// `undefined` for a read the story writes to, such as `args.count++`.
function readEdit(
  read: NodePath,
  arg: string,
  fallback: string,
  slot: Slot | undefined,
  element: SpreadElement
): Edit | undefined {
  if (isWritten(read) || mayChange(read)) {
    return undefined;
  }
  if (!slot) {
    return startsOperand(read)
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
  const unset = fallback
    ? `${named ? `${prefix}${name}=` : ''}\${${fallback}}`
    : kind === 'prop'
      ? unsetProperty(name, slot.tag, element)
      : '';
  return { start, end, text: argHole(kind, [...(named ? [name] : []), arg], unset) };
}

// lit sets a property to `undefined` while its arg is unset, which only shows on a field the
// element gives a default.
function unsetProperty(
  name: string,
  tag: string,
  { tag: own, declaration }: SpreadElement
): string {
  const field =
    tag === own
      ? declaration?.members?.find((member) => member.kind === 'field' && member.name === name)
      : undefined;
  const value = field && 'default' in field ? field.default : undefined;
  return value === undefined || value === 'undefined' ? '' : `.${name}=\${undefined}`;
}

// The args passed along whole, as in `${spread(args)}`: the object they are, as a literal.
function wholeEdit(read: NodePath, omitted: string[]): Edit | undefined {
  const { node, parentPath: parent } = read;
  if (!read.isIdentifier() || !parent || parent.isTSTypeQuery() || mayChange(read)) {
    return undefined;
  }
  const literal = hole('args', ...omitted.map((name) => holeWord(`-${name}`)));
  if (parent.isObjectProperty() && parent.node.shorthand) {
    return nodeEdit(parent.node, `${read.node.name}: ${literal}`);
  }
  return nodeEdit(node, startsOperand(read) ? `(${literal})` : literal);
}

// Whether the story may change the object `read` reads, or one in it: it writes to a property, calls
// a method that changes an array, or passes it to a call that writes to it, also through a name it
// declares for it, as in `const list = args.items`, or a callback's parameter.
function mayChange(read: NodePath): boolean {
  const changedThrough = (pattern: NodePath, within: NodePath) =>
    Object.keys(pattern.getBindingIdentifiers()).some((name) =>
      pattern.scope
        .getBinding(name)
        ?.referencePaths.some(
          (reference) => !reference.isDescendant(within) && mayChange(reference)
        )
    );
  for (let value = read; ; value = value.parentPath!) {
    const { parentPath: parent } = value;
    if (
      parent?.isTSAsExpression() ||
      parent?.isTSSatisfiesExpression() ||
      parent?.isTSNonNullExpression() ||
      parent?.isParenthesizedExpression() ||
      parent?.isLogicalExpression() ||
      parent?.isSequenceExpression() ||
      (parent?.isConditionalExpression() && parent.node.test !== value.node)
    ) {
      continue;
    }
    if (parent?.isVariableDeclarator() && parent.node.init === value.node) {
      return changedThrough(parent.get('id'), parent);
    }
    if (parent?.isAssignmentExpression() && parent.node.right === value.node) {
      return true;
    }
    if (
      parent?.isCallExpression() ||
      parent?.isOptionalCallExpression() ||
      parent?.isNewExpression()
    ) {
      const index = (parent.node.arguments as t.Node[]).indexOf(value.node);
      if (index >= 0) {
        return index === 0 && WRITING_CALLS.includes(calleeName(parent.node.callee));
      }
    }
    if (
      (!parent?.isMemberExpression() && !parent?.isOptionalMemberExpression()) ||
      parent.node.object !== value.node
    ) {
      return false;
    }
    const call = parent.parentPath;
    const { property, computed } = parent.node;
    const method =
      (call?.isCallExpression() || call?.isOptionalCallExpression()) &&
      call.node.callee === parent.node;
    if (
      isWritten(parent) ||
      (method && !computed && t.isIdentifier(property) && ARRAY_MUTATORS.includes(property.name)) ||
      (method &&
        (call.get('arguments') as NodePath[]).some(
          (argument) =>
            argument.isFunction() &&
            argument.get('params').some((param) => changedThrough(param, param))
        ))
    ) {
      return true;
    }
  }
}

// `Object.assign`, as a call names its callee.
const calleeName = (callee: t.Node): string =>
  (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
  !callee.computed &&
  t.isIdentifier(callee.object) &&
  t.isIdentifier(callee.property)
    ? `${callee.object.name}.${callee.property.name}`
    : '';

const WRITING_CALLS = [
  'Object.assign',
  'Object.defineProperty',
  'Object.defineProperties',
  'Object.setPrototypeOf',
  'Reflect.set',
  'Reflect.defineProperty',
  'Reflect.deleteProperty',
  'Reflect.setPrototypeOf',
];

const ARRAY_MUTATORS = [
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
];

// The places a name is read; `undefined` when the story assigns to it.
function referencesOf(scope: Scope, name: string): NodePath[] | undefined {
  const binding = scope.getBinding(name);
  return binding && binding.constantViolations.length === 0 ? binding.referencePaths : undefined;
}

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
// one that reads the story's own names, or is not the same value at each read, such as a call.
function fallbackCode(
  fallback: NodePath<t.Expression>,
  pattern: NodePath,
  code: string
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

const startsOperand = (read: NodePath) =>
  isOperand(
    read.node,
    read
      .getAncestry()
      .slice(1)
      .map((path) => path.node)
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
