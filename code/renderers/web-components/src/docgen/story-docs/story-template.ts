import { types as t } from 'storybook/internal/babel';
import { isOperand, unwrapExpression } from 'storybook/internal/csf-tools';
import {
  asOperand,
  dedentStoryCode,
  hasHoleBracket,
  hole,
  isHoleWord,
  printValue,
} from 'storybook/internal/docs-tools';
import type { StrictArgTypes } from 'storybook/internal/types';

import { fillTemplate } from '../../docs/fill-template.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { classifyArg } from './classify-args.ts';
import type { Binding, Fallback, Frame, Markup, TemplateModule } from './template-calls.ts';
import {
  calleeName,
  children,
  renderFrame,
  resolveBinding,
  resolveMarkup,
} from './template-calls.ts';

/** The component's element, and the `binding=arg` words a spread of the args passes to it. */
export interface SpreadElement {
  tag: string;
  words: string[];
}

type ArgsBinding = Extract<Binding, { kind: 'args' }>;

// `open` holds the constants being written, as one may be named in its own value, and `depth`
// counts the templates written inside one another, as a function may call itself.
interface Writing {
  depth: number;
  element: SpreadElement;
  open: Set<t.Node>;
}

const MAX_DEPTH = 16;

// Directives that pass an object along to the element they sit on, as `@open-wc/lit-helpers` has.
const SPREADS = ['spread', 'spreadProps', 'spreadEvents'];

/**
 * A `binding=arg` word per arg the component declares as an attribute, `.property` or
 * `--custom-property`, the story's own first.
 */
export function argsWords(
  storyArgs: string[],
  argTypes: StrictArgTypes,
  declaration: ManifestDeclaration
): string[] {
  const words = new Map<string, string>();
  for (const arg of new Set([...storyArgs, ...Object.keys(argTypes)])) {
    const { kind, ...rest } = classifyArg(arg, false, argTypes, declaration);
    const name = 'name' in rest ? rest.name : '';
    const binding =
      kind === 'property' ? `.${name}` : kind === 'attribute' || /^--/.test(name) ? name : '';
    // A field and its attribute are both args; the first one sets the attribute.
    if (binding && !words.has(binding)) {
      words.set(binding, `${binding}=${arg}`);
    }
  }
  return [...words.values()];
}

/** `<tag⟦props …⟧></tag>` for a story without a render function, with its {@link argsWords}. */
export function argsTemplate(tag: string, words: string[]): string | undefined {
  return words.every(isHoleWord) ? `<${tag} ${hole('props', ...words)}></${tag}>` : undefined;
}

/**
 * The html a render function returns as written, with a hole wherever it reads an arg, or
 * `undefined` when it reads the args in a way no hole stands for. A function it calls for its html
 * is read as if written in place, with its parameters bound to what the call passes.
 */
export function litTemplate(
  render: t.Function,
  module: TemplateModule,
  element: SpreadElement
): string | undefined {
  const root = renderFrame(render, module);
  const markup = root && resolveMarkup(root.returned, root.frame);
  const text = markup && writeMarkup(markup, { depth: 0, element, open: new Set() });
  // The code has no hole bracket, so a bracket in the text is a hole written for an arg.
  if (!text || !hasHoleBracket(text)) {
    return undefined;
  }
  // The html starts after the backtick, mostly on a new line whose indentation the others share.
  const column = /^\s*\n([ \t]*)/.exec(text)?.[1]!.length;
  return dedentStoryCode(text.trim(), column);
}

function writeMarkup({ quasis, expressions, frame }: Markup, writing: Writing): string | undefined {
  if (hasHoleBracket(frame.module.code) || writing.depth > MAX_DEPTH) {
    return undefined;
  }
  writing = { ...writing, depth: writing.depth + 1 };
  let text = quasis[0]!;
  for (const [index, expression] of expressions.entries()) {
    let next = quasis[index + 1]!;
    const bound = resolveBinding(expression, frame);
    const arg = bound?.kind === 'arg' && bound.path.length === 0 ? bound : undefined;
    const value = valueText(expression, frame, writing);
    const before = quasis.slice(0, index + 1).join('');
    const tag = tagStart(before) === -1 ? undefined : before.slice(tagStart(before));
    // `name=${…}`, `name="${…}"`, `?name=${…}` or `.name=${…}`, after the tag name or an attribute.
    const binding = /(?<=\s)([?@.]?)([^\s"'<>/=.?@][^\s"'<>/=]*)=("?)$/.exec(quasis[index]!);
    if (tag && binding && next.startsWith(binding[3]!)) {
      const [whole, prefix, name, quote] = binding;
      const kind = prefix === '?' ? 'bool' : prefix === '.' ? 'prop' : 'attr';
      // An event binding that reads an arg passes a listener, which the snippet leaves out.
      const listener = prefix === '@' && (value === undefined || hasHoleBracket(value));
      const written = listener
        ? ''
        : arg
          ? argHole(kind, [name!, arg.name], arg.fallback, writing)
          : bound?.kind === 'value' && prefix !== '@'
            ? fillTemplate(hole(kind, name!, 'value'), { value: bound.value })
            : undefined;
      if (written !== undefined) {
        const start = text.slice(0, -whole.length);
        text = written ? start + written : start.trimEnd();
        next = next.slice(quote!.length);
      } else if (arg || value === undefined) {
        return undefined;
      } else {
        text += `\${${value}}`;
      }
    } else if (tag && value !== undefined) {
      text += `\${${value}}`;
    } else if (tag) {
      const element = /^<([^\s>/]+)/.exec(tag)?.[1] === writing.element.tag;
      const written = writtenNames(`${tag} ${tagRest(quasis.slice(index + 1))}`);
      const spread = element ? spreadText(expression, frame, written, writing) : undefined;
      if (spread === undefined) {
        return undefined;
      }
      text = spread ? text + spread : text.trimEnd();
    } else if (arg) {
      const written = argHole('text', [arg.name], arg.fallback, writing);
      if (written === undefined) {
        return undefined;
      }
      text += written;
    } else if (bound?.kind === 'value') {
      text += staticText(bound.value);
    } else {
      // A function called with the args whole, or a name for html, is written in place.
      const named = value === undefined || t.isIdentifier(unwrapExpression(expression));
      const nested = named ? resolveMarkup(expression, frame) : undefined;
      const written = nested ? writeMarkup(nested, writing)?.trim() : value && `\${${value}}`;
      if (written === undefined) {
        return undefined;
      }
      text += written;
    }
    text += next;
  }
  return text;
}

// The expression as written with `⟦value arg⟧` for each arg it reads, or `undefined` when it reads
// one in a way no hole stands for.
function valueText(expression: t.Expression, frame: Frame, writing: Writing): string | undefined {
  if (hasHoleBracket(frame.module.code)) {
    return undefined;
  }
  const names = new Set(frame.names.keys());
  const declared = () => declaredNames(expression);
  const edits: { start: number; end: number; text: string }[] = [];
  const replace = (node: t.Node, text: string | undefined) => {
    edits.push({ start: node.start!, end: node.end!, text: text ?? '' });
    return text !== undefined;
  };
  const visit = (node: t.Node, ancestors: t.Node[] = []): boolean => {
    const bound = t.isExpression(node) ? resolveBinding(node, frame) : undefined;
    const operand = isOperand(node, ancestors);
    if (bound?.kind === 'arg' && (bound.path.length === 0 || t.isIdentifier(node))) {
      const kind = operand || bound.path.length > 0 ? 'operand' : 'value';
      const read = argHole(kind, [bound.name], bound.fallback, writing);
      return replace(node, read && read + bound.path.map(memberText).join(''));
    }
    if (bound?.kind === 'value') {
      const printed = printValue(bound.value, '');
      return replace(node, operand ? asOperand(printed) : printed);
    }
    if (bound?.kind === 'code') {
      // Code of the calling template may not name what the code around it here binds.
      if (writing.open.has(bound.expression) || namesAny(bound.expression, declared())) {
        return false;
      }
      writing.open.add(bound.expression);
      const written = valueText(bound.expression, bound.frame, writing);
      writing.open.delete(bound.expression);
      const whole = ancestors.length === 0 || isPrimary(bound.expression);
      return replace(node, written && (whole ? written : `(${written})`));
    }
    if (
      (bound && bound.kind !== 'arg') ||
      (t.isObjectProperty(node) && node.shorthand && bindsName(node.value, names)) ||
      (t.isFunction(node) && node.params.some((param) => bindsName(param, names))) ||
      (t.isVariableDeclarator(node) && bindsName(node.id, names))
    ) {
      return false;
    }
    const written = edits.length;
    const asWritten = children(node).every((child) => visit(child, [node, ...ancestors]));
    if (asWritten || !t.isCallExpression(node) || ancestors.length === 0) {
      return asWritten;
    }
    // A call that takes the args whole is written as the html it returns.
    edits.length = written;
    const markup = resolveMarkup(node, frame);
    const html = markup && writeMarkup(markup, writing);
    return replace(node, html === undefined ? undefined : `html\`${html}\``);
  };
  if (!visit(expression)) {
    return undefined;
  }
  let text = frame.module.code.slice(expression.start!, expression.end!);
  for (const { start, end, text: hole } of edits.sort((a, b) => b.start - a.start)) {
    const offset = expression.start!;
    text = text.slice(0, start - offset) + hole + text.slice(end - offset);
  }
  return text;
}

// A hole for an arg, whose last word is what a parameter default prints while the arg is unset.
function argHole(
  kind: string,
  words: string[],
  fallback: Fallback | undefined,
  writing: Writing
): string | undefined {
  const printed = fallback ? fallbackText(kind, words[0]!, fallback, writing) : '';
  if (printed === undefined || hasHoleBracket(printed) || !words.every(isHoleWord)) {
    return undefined;
  }
  return hole(kind, ...words, ...(printed ? [`?${encodeURIComponent(printed)}`] : []));
}

function fallbackText(
  kind: string,
  name: string,
  fallback: Fallback,
  writing: Writing
): string | undefined {
  if (fallback.kind === 'value') {
    return ['value', 'operand'].includes(kind)
      ? fillTemplate(hole(kind, 'value'), { value: fallback.value })
      : kind === 'text'
        ? staticText(fallback.value)
        : fillTemplate(hole(kind, name, 'value'), { value: fallback.value });
  }
  const code = valueText(fallback.expression, fallback.frame, writing);
  if (code === undefined) {
    return undefined;
  }
  switch (kind) {
    case 'value':
    case 'operand':
      return isPrimary(fallback.expression) ? code : `(${code})`;
    case 'text':
      return `\${${code}}`;
    default:
      return `${kind === 'bool' ? '?' : kind === 'prop' ? '.' : ''}${name}=\${${code}}`;
  }
}

const staticText = (value: unknown) => fillTemplate(hole('text', 'value'), { value });

// What `${spread(args)}` in a tag passes to the element: a props hole, or nothing for listeners.
function spreadText(
  expression: t.Expression,
  frame: Frame,
  written: string[],
  writing: Writing
): string | undefined {
  const call = unwrapExpression(expression);
  const name = t.isCallExpression(call) ? calleeName(call.callee, frame) : undefined;
  if (!t.isCallExpression(call) || !name || !SPREADS.includes(name)) {
    return undefined;
  }
  const [passed, excluded, ...more] = call.arguments;
  const args = passed && resolveBinding(passed, frame);
  // A project's own `spread` may take the names it leaves out.
  const left = t.isArrayExpression(excluded)
    ? excluded.elements.map((item) => (t.isStringLiteral(item) ? item.value : undefined))
    : [];
  if (
    args?.kind !== 'args' ||
    !args.open ||
    more.length > 0 ||
    (excluded && !t.isArrayExpression(excluded)) ||
    left.includes(undefined)
  ) {
    return undefined;
  }
  return name === 'spreadEvents' ? '' : propsText(args, left as string[], written, writing);
}

// The props hole of a spread, with what the call wrote over the args next to it. An arg the tag
// writes as well gets a `^arg` word: while it is set, which of the two the element shows is not
// known.
function propsText(
  args: ArgsBinding,
  left: string[],
  written: string[],
  writing: Writing
): string | undefined {
  const fixed: string[] = [];
  const words: string[] = [];
  for (const word of writing.element.words) {
    const [binding = '', arg = ''] = word.split(/=(.*)/);
    const entry = args.entries.get(arg);
    const collides = written.includes(
      binding.startsWith('--') ? 'style' : binding.replace('.', '')
    );
    if (left.includes(arg) || args.omitted.has(arg)) {
      continue;
    }
    if (!entry) {
      words.push(collides ? `^${arg}` : word);
    } else if (entry.kind === 'value' && !collides) {
      fixed.push(fillTemplate(hole('props', `${binding}=value`), { value: entry.value }));
    } else if (entry.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      words.push(collides ? `^${entry.name}` : `${binding}=${entry.name}`);
    } else {
      return undefined;
    }
  }
  if (!words.every(isHoleWord)) {
    return undefined;
  }
  return [words.length > 0 ? hole('props', ...words) : '', ...fixed].filter(Boolean).join(' ');
}

// The names of the attributes and properties a tag writes, whatever they are bound with.
const writtenNames = (tag: string) =>
  [...tag.replace(/"[^"]*"|'[^']*'/g, '""').matchAll(/\s[?.]?([^\s"'<>/=?.@]+)/g)].map(
    ([, name]) => name!
  );

// The rest of a tag whose start is already read, up to the `>` that ends it.
function tagRest(quasis: string[]): string {
  const rest = quasis.join(' ');
  let quote = '';
  for (const [index, char] of [...rest].entries()) {
    if (quote) {
      quote = char === quote ? '' : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return rest.slice(0, index);
    }
  }
  return rest;
}

// Where the tag that html ending with `before` is inside starts, or `-1` outside a tag; a `>` in a
// quoted value does not end the tag.
function tagStart(before: string): number {
  let state: 'text' | 'tag' | '"' | "'" = 'text';
  let start = -1;
  for (const [index, char] of [...before].entries()) {
    if (state === 'text') {
      state = char === '<' && /[a-zA-Z/]/.test(before[index + 1] ?? '') ? 'tag' : 'text';
      start = state === 'tag' ? index : start;
    } else if (state === 'tag') {
      state = char === '>' ? 'text' : char === '"' || char === "'" ? char : 'tag';
    } else if (char === state) {
      state = 'tag';
    }
  }
  return state === 'text' ? -1 : start;
}

const memberText = (key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;

// Whether code reading on from an expression reads it whole, without parentheses around it.
const isPrimary = (expression: t.Expression) =>
  t.isIdentifier(expression) ||
  t.isLiteral(expression) ||
  t.isMemberExpression(expression) ||
  t.isCallExpression(expression) ||
  t.isArrayExpression(expression) ||
  t.isTaggedTemplateExpression(expression);

// The names the functions and declarations inside an expression bind.
const declaredNames = (node: t.Node): Set<string> =>
  new Set([
    ...(t.isFunction(node) ? node.params : t.isVariableDeclarator(node) ? [node.id] : []).flatMap(
      (bound) => Object.keys(t.getBindingIdentifiers(bound))
    ),
    ...children(node).flatMap((child) => [...declaredNames(child)]),
  ]);

const namesAny = (node: t.Node, names: Set<string>): boolean =>
  names.size > 0 &&
  (t.isIdentifier(node)
    ? names.has(node.name)
    : children(node).some((child) => namesAny(child, names)));

const bindsName = (param: t.Node, names: Set<string>) =>
  Object.keys(t.getBindingIdentifiers(param)).some((name) => names.has(name));
