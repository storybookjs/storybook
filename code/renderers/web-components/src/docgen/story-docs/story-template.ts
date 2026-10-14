import { types as t } from 'storybook/internal/babel';
import { isOperand, unwrapExpression } from 'storybook/internal/csf-tools';
import {
  asOperand,
  dedentStoryCode,
  defaultWord,
  hasHoleBracket,
  hole,
  holeWord,
  printValue,
} from 'storybook/internal/docs-tools';
import type { StrictArgTypes } from 'storybook/internal/types';

import { fillTemplate } from '../../docs/fill-template.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { classifyArg } from './classify-args.ts';
import { parseHtml, printHtml } from './html-tree.ts';
import type {
  Binding,
  Fallback,
  Frame,
  Markup,
  Template,
  TemplateModule,
} from './template-calls.ts';
import {
  bindArgsConstant,
  calledFunction,
  calleeName,
  children,
  paramFrame,
  renderFrame,
  resolveBinding,
  resolveTemplate,
  writesLitHtml,
} from './template-calls.ts';

/**
 * The component's element, the `binding=arg` words a spread of the args passes to it, and, where
 * known, its manifest declaration and the args the story sets.
 */
export interface SpreadElement {
  tag: string;
  words: string[];
  declaration?: ManifestDeclaration;
  args?: string[];
}

/** A story's template, and the args it leaves out as listeners. */
export interface LiveTemplate {
  template: string;
  listeners: string[];
}

type ArgsBinding = Extract<Binding, { kind: 'args' }>;

// `open` holds the constants being written, as one may be named in its own value, and `depth`
// counts the templates written inside one another, as a function may call itself. `markup` writes
// html in code with holes for its attributes, as a function body is written; `listeners` collects
// the listeners that read an arg, which the snippet leaves out.
interface Writing {
  depth: number;
  element: SpreadElement;
  open: Set<t.Node>;
  markup: boolean;
  listeners: string[];
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
export function argsTemplate(tag: string, words: string[]): string {
  return `<${tag} ${hole('props', ...words.map(holeWord))}></${tag}>`;
}

/**
 * The html a render function returns as written, with a hole wherever it reads an arg, or
 * `undefined` when it reads the args in a way no hole stands for. A function it calls for its html
 * is read as if written in place, with its parameters bound to what the call passes and each `if`
 * it returns from as a condition. A render whose body does more than declare constants and return
 * is written as its body.
 */
export function litTemplate(
  render: t.Function,
  module: TemplateModule,
  element: SpreadElement
): LiveTemplate | undefined {
  const writing: Writing = { depth: 0, element, open: new Set(), markup: false, listeners: [] };
  const root = renderFrame(render, module);
  const template = root && resolveTemplate(root.returned, root.frame);
  // A render that only calls a function is written as that function's body when it has statements.
  const called = root && !template ? calledFunction(root.returned, root.frame) : undefined;
  const params = root ? undefined : paramFrame(render, module);
  const text = template
    ? template.kind === 'markup'
      ? writeMarkup(template.markup, writing)
      : writeTemplate(template, writing, 'child')
    : called
      ? bodyText(called.fn, called.frame, { ...writing, markup: true })
      : params && bodyText(render, params, { ...writing, markup: true });
  // The code has no hole bracket, so a bracket in the text is a hole written for an arg.
  if (!text || !hasHoleBracket(text)) {
    return undefined;
  }
  // The html starts after the backtick, mostly on a new line whose indentation the others share.
  const column = /^\s*\n([ \t]*)/.exec(text)?.[1]!.length;
  return { template: dedentStoryCode(text.trim(), column), listeners: writing.listeners };
}

// A template as html where `position` is `child`, or as an expression where it is `code`.
function writeTemplate(
  template: Template,
  writing: Writing,
  position: 'child' | 'code'
): string | undefined {
  const wrap = (code: string | undefined, primary: boolean) =>
    code === undefined
      ? undefined
      : position === 'child'
        ? `\${${code}}`
        : primary
          ? code
          : `(${code})`;
  switch (template.kind) {
    case 'markup': {
      const html = writeMarkup(template.markup, writing);
      return html === undefined
        ? undefined
        : position === 'child'
          ? html.trim()
          : `html\`${html}\``;
    }
    case 'code':
      return wrap(
        valueText(template.expression, template.frame, writing),
        isPrimary(template.expression)
      );
    case 'toolkit': {
      const html = toolkitText(template, writing);
      return html === undefined ? undefined : position === 'child' ? html : `html\`${html}\``;
    }
    case 'choice': {
      const known = decide(template, writing);
      if (known) {
        const branch = writeTemplate(
          known.value ? template.then : template.otherwise,
          writing,
          position
        );
        const guards = known.guards.map((arg) => hole('props', holeWord(`^${arg}`))).join('');
        return branch === undefined ? undefined : guards + branch;
      }
      const test = valueText(template.test, template.frame, writing);
      const then = writeTemplate(template.then, writing, 'code');
      const otherwise = writeTemplate(template.otherwise, writing, 'code');
      const lower =
        t.isConditionalExpression(template.test) ||
        t.isAssignmentExpression(template.test) ||
        t.isSequenceExpression(template.test) ||
        t.isArrowFunctionExpression(template.test);
      return test === undefined || then === undefined || otherwise === undefined
        ? undefined
        : wrap(`${lower ? `(${test})` : test} ? ${then} : ${otherwise}`, false);
    }
  }
}

/**
 * The branch an `if` of a function the story calls takes, where it is known from the values the
 * call passes or from args the story leaves unset. Each of those args is `guards`: while one is set,
 * the branch is not known, so the template is not either.
 */
function decide(
  template: Extract<Template, { kind: 'choice' }>,
  writing: Writing
): { value: boolean; guards: string[] } | undefined {
  const guards = new Set<string>();
  const known = evaluate(template.test, template.frame, writing, guards);
  // A condition of the story's own code, as written, is a condition of the snippet too.
  if (!known || (!template.statement && guards.size > 0)) {
    return undefined;
  }
  return { value: Boolean(known.value), guards: [...guards] };
}

// The value of an expression of literals, values a call passes and args the story leaves unset.
function evaluate(
  node: t.Node,
  frame: Frame,
  writing: Writing,
  guards: Set<string>
): { value: unknown } | undefined {
  const read = (item: t.Node) => evaluate(item, frame, writing, guards);
  const expression = unwrapExpression(node);
  if (t.isIdentifier(expression) || t.isMemberExpression(expression)) {
    const bound = resolveBinding(expression, frame);
    if (bound?.kind === 'value') {
      return { value: bound.value };
    }
    if (bound?.kind === 'code') {
      return evaluate(bound.expression, bound.frame, writing, guards);
    }
    if (
      bound?.kind === 'arg' &&
      !bound.fallback &&
      writing.element.args &&
      !writing.element.args.includes(bound.name)
    ) {
      guards.add(bound.name);
      return { value: undefined };
    }
    return !bound && t.isIdentifier(expression, { name: 'undefined' })
      ? { value: undefined }
      : undefined;
  }
  if (
    t.isStringLiteral(expression) ||
    t.isNumericLiteral(expression) ||
    t.isBooleanLiteral(expression)
  ) {
    return { value: expression.value };
  }
  if (t.isNullLiteral(expression)) {
    return { value: null };
  }
  if (t.isUnaryExpression(expression) && ['!', 'typeof'].includes(expression.operator)) {
    const operand = read(expression.argument);
    return (
      operand && { value: expression.operator === '!' ? !operand.value : typeof operand.value }
    );
  }
  if (t.isLogicalExpression(expression)) {
    const left = read(expression.left);
    if (!left) {
      return undefined;
    }
    const decided =
      expression.operator === '||'
        ? Boolean(left.value)
        : expression.operator === '&&'
          ? !left.value
          : left.value !== null && left.value !== undefined;
    return decided ? left : read(expression.right);
  }
  if (
    t.isBinaryExpression(expression) &&
    ['===', '!==', '==', '!='].includes(expression.operator)
  ) {
    const left = read(expression.left);
    const right = left && read(expression.right);
    if (!left || !right) {
      return undefined;
    }
    const equal =
      expression.operator.length === 3 ? left.value === right.value : left.value == right.value;
    return { value: expression.operator.startsWith('!') ? !equal : equal };
  }
  return undefined;
}

// The body of a function as written, without the constants that only hold the args or one of them.
function bodyText(fn: t.Function, frame: Frame, writing: Writing): string | undefined {
  const { body } = fn;
  // A body that builds its element with DOM calls has the element html of the static snippet.
  if (!t.isBlockStatement(body) || !writesLitHtml(body, frame)) {
    return undefined;
  }
  // A parameter that holds no args or values, such as the story context, has nothing in the
  // snippet to name it.
  const others = fn.params
    .flatMap((param) => Object.keys(t.getBindingIdentifiers(param)))
    .filter((name) => !frame.names.has(name));
  if (namesAny(body, new Set(others))) {
    return undefined;
  }
  const dropped = new Set(body.body.filter((statement) => bindArgsConstant(statement, frame)));
  return codeText(body, frame, writing, dropped)?.slice(1, -1);
}

function writeMarkup({ quasis, expressions, frame }: Markup, writing: Writing): string | undefined {
  if (hasHoleBracket(frame.module.code) || writing.depth > MAX_DEPTH) {
    return undefined;
  }
  writing = { ...writing, depth: writing.depth + 1 };
  let text = quasis[0]!;
  for (const [index, expression] of expressions.entries()) {
    let next = quasis[index + 1]!;
    // A boolean binding reads only whether its value is truthy, so `!!value` binds what `value` does.
    const truthy = /\?[^\s"'<>/=]+="?$/.test(quasis[index]!)
      ? doubleNegated(expression)
      : undefined;
    const bound = resolveBinding(truthy ?? expression, frame);
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
      if (listener) {
        writing.listeners.push(name!);
      }
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
      // `@open-wc/lit-helpers` binds a spread to an attribute named `...`.
      text = text.replace(/\s\.\.\.=$/, ' ');
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
      const nested = named ? resolveTemplate(expression, frame) : undefined;
      const written = nested ? writeTemplate(nested, writing, 'child') : value && `\${${value}}`;
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
const valueText = (expression: t.Expression, frame: Frame, writing: Writing) =>
  codeText(expression, frame, writing);

// Code as written, an expression or a statement, with a hole for each arg it reads.
function codeText(
  expression: t.Node,
  frame: Frame,
  writing: Writing,
  dropped = new Set<t.Node>()
): string | undefined {
  const { code } = frame.module;
  if (hasHoleBracket(code)) {
    return undefined;
  }
  const names = new Set(frame.names.keys());
  const declared = () => declaredNames(expression);
  const edits: { start: number; end: number; text: string }[] = [];
  const replace = (node: t.Node, text: string | undefined) => {
    edits.push({ start: node.start!, end: node.end!, text: text ?? '' });
    return text !== undefined;
  };
  // Html written in a body from another place is indented as the line it is written on.
  const inline = (node: t.Node, text: string | undefined) =>
    replace(node, writing.markup && text ? indentAs(text, lineIndent(code, node.start!)) : text);
  const visit = (node: t.Node, ancestors: t.Node[] = []): boolean => {
    if (dropped.has(node)) {
      // The line a dropped statement is on goes with it.
      const start = node.start! - /[ \t]*$/.exec(code.slice(0, node.start!))![0].length;
      const end = node.end! + /^[ \t]*\n?/.exec(code.slice(node.end!))![0].length;
      edits.push({ start, end, text: '' });
      return true;
    }
    if (writesArgs(node, frame)) {
      return false;
    }
    if (writing.markup && t.isTaggedTemplateExpression(node)) {
      const template = resolveTemplate(node, frame);
      if (template) {
        return inline(node, writeTemplate(template, writing, 'code'));
      }
    }
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
      return inline(node, written && (whole ? written : `(${written})`));
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
    const template = resolveTemplate(node, frame);
    return inline(node, template && writeTemplate(template, writing, 'code'));
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

const lineIndent = (code: string, offset: number) =>
  /^[ \t]*/.exec(code.slice(code.lastIndexOf('\n', offset - 1) + 1))![0];

// The lines after the first of `text`, moved as a whole to start at `indent`.
function indentAs(text: string, indent: string): string {
  const [first, ...rest] = text.split('\n');
  const indents = rest.filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)![0].length);
  const least = Math.min(...indents);
  return [first, ...rest.map((line) => (line.trim() ? indent + line.slice(least) : line))].join(
    '\n'
  );
}

// A hole for an arg, whose last word is what a parameter default prints while the arg is unset.
function argHole(
  kind: string,
  words: string[],
  fallback: Fallback | undefined,
  writing: Writing
): string | undefined {
  const printed = fallback ? fallbackText(kind, words[0]!, fallback, writing) : '';
  if (printed === undefined || hasHoleBracket(printed)) {
    return undefined;
  }
  return hole(kind, ...words.map(holeWord), ...(printed ? [defaultWord(printed)] : []));
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

/**
 * The element `template(args, slot)` of `@wc-toolkit/storybook-helpers` renders, which sorts the args
 * by the manifest: attributes and fields as a props hole, CSS properties in its `style` and slots as
 * content. Args the manifest does not name are attributes. Listeners, part and state styles are left
 * out.
 */
function toolkitText(
  { tag, passed, slot, frame }: Extract<Template, { kind: 'toolkit' }>,
  writing: Writing
): string | undefined {
  const { declaration } = writing.element;
  if (tag !== writing.element.tag || !declaration) {
    return undefined;
  }
  if (passed.kind === 'value' && passed.value === undefined) {
    return `<${tag}></${tag}>`;
  }
  if (passed.kind !== 'args') {
    return undefined;
  }
  const { bindings, slots, known } = toolkitArgs(declaration);
  const keys = [...passed.entries.keys(), ...(passed.open ? (writing.element.args ?? []) : [])];
  for (const key of new Set(keys)) {
    if (!known.has(key) && !key.startsWith('on') && !passed.omitted.has(key)) {
      bindings.push({ binding: key, key, bool: false });
    }
  }
  const entryOf = (key: string): Binding | undefined =>
    passed.entries.get(key) ??
    (passed.open && !passed.omitted.has(key) ? { kind: 'arg', name: key, path: [] } : undefined);
  const words: string[] = [];
  const written: string[] = [];
  for (const { binding, key, bool } of bindings) {
    const entry = entryOf(key);
    if (!entry) {
      continue;
    }
    const value = valueOf(entry);
    if (entry.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      words.push(`${binding}=${entry.name}`);
    } else if (value) {
      written.push(fillTemplate(hole('props', `${binding}=value`), { value: value.value }));
    } else if (entry.kind === 'code' && !binding.startsWith('--')) {
      const code = valueText(entry.expression, entry.frame, writing);
      if (code === undefined) {
        return undefined;
      }
      written.push(`${bool ? '?' : ''}${binding}=\${${code}}`);
    } else {
      return undefined;
    }
  }
  const content: string[] = [];
  for (const { name, key } of slots) {
    const entry = entryOf(key);
    if (!entry) {
      continue;
    }
    if (entry.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      content.push(hole('slot', holeWord(name), holeWord(entry.name)));
    } else if (entry.kind === 'value') {
      const html = slotHtml(name, entry.value);
      if (html === undefined) {
        return undefined;
      }
      content.push(html);
    } else if (entry.kind === 'code') {
      const code = valueText(entry.expression, entry.frame, writing);
      if (code === undefined) {
        return undefined;
      }
      const html = `\${unsafeHTML(${code})}`;
      content.push(name === 'default' ? html : `<span slot="${name}">${html}</span>`);
    } else {
      return undefined;
    }
  }
  if (slot) {
    const nested = resolveTemplate(slot, frame);
    const code = nested ? undefined : valueText(slot, frame, writing);
    const html = nested ? writeTemplate(nested, writing, 'child') : code && `\${${code}}`;
    if (html === undefined) {
      return undefined;
    }
    content.push(html);
  }
  const start = [tag, words.length > 0 ? hole('props', ...words.map(holeWord)) : '', ...written]
    .filter(Boolean)
    .join(' ');
  const inner = content.filter((item) => item !== '');
  return inner.length === 0
    ? `<${start}></${tag}>`
    : `<${start}>\n${inner.map((item) => `  ${item}`).join('\n')}\n</${tag}>`;
}

// The html `@wc-toolkit/storybook-helpers` renders for a slot's value: each element of html for a
// named slot gets `slot`, and its text a `<span slot>` of its own.
function slotHtml(name: string, value: unknown): string | undefined {
  const print = (html: unknown) => fillTemplate(hole('slot', 'default', 'value'), { value: html });
  if (name === 'default' || typeof value !== 'string' || !/[<&]/.test(value)) {
    try {
      return fillTemplate(hole('slot', name, 'value'), { value });
    } catch {
      return undefined;
    }
  }
  const nodes = parseHtml(value).map((node) =>
    node.kind === 'element'
      ? printHtml([
          {
            ...node,
            attributes: [
              ...node.attributes.filter((attribute) => attribute.name !== 'slot'),
              { name: 'slot', quoted: true, value: name },
            ],
          },
        ])
      : node.kind === 'text' && !/[<&]/.test(node.text)
        ? `<span slot="${name}">${node.text}</span>`
        : node.kind === 'comment'
          ? ''
          : undefined
  );
  return nodes.every((node) => node !== undefined) ? print(nodes.join('')) : undefined;
}

// The value a binding holds, also as an object of values, as `{ style: 'currency' }` is.
function valueOf(binding: Binding): { value: unknown } | undefined {
  if (binding.kind === 'value') {
    return { value: binding.value };
  }
  if (binding.kind !== 'args' || binding.open) {
    return undefined;
  }
  const object: Record<string, unknown> = {};
  for (const [key, entry] of binding.entries) {
    const value = valueOf(entry);
    if (!value) {
      return undefined;
    }
    object[key] = value.value;
  }
  return { value: object };
}

// What `@wc-toolkit/storybook-helpers` reads from the manifest: the binding of each attribute,
// field and CSS property with the arg that sets it, the slots, and every arg name it knows.
function toolkitArgs(declaration: ManifestDeclaration) {
  const bindings: { binding: string; key: string; bool: boolean }[] = [];
  const slots: { name: string; key: string }[] = [];
  const known = new Set<string>();
  for (const member of declaration.members ?? []) {
    known.add(member.name);
    if (member.kind === 'method') {
      known.add(`${member.name}-method`);
    }
    if (
      member.kind !== 'field' ||
      member.privacy === 'private' ||
      member.privacy === 'protected' ||
      member.static
    ) {
      continue;
    }
    const attribute = declaration.attributes?.find(({ fieldName }) => fieldName === member.name);
    const type =
      (member as { parsedType?: { text?: string } }).parsedType?.text ?? member.type?.text ?? '';
    if (attribute) {
      known.add(attribute.name);
      const bool = type
        .toLowerCase()
        .split('|')
        .some((item) => item.trim() === 'boolean');
      bindings.push({ binding: attribute.name, key: attribute.name, bool });
    } else if (!member.name.startsWith('on')) {
      bindings.push({ binding: `.${member.name}`, key: member.name, bool: false });
    }
  }
  for (const { name } of declaration.cssProperties ?? []) {
    known.add(name);
    bindings.push({ binding: name, key: name, bool: false });
  }
  for (const { name } of declaration.slots ?? []) {
    const slot = name || 'default';
    known.add(name);
    known.add(`${slot}-slot`);
    slots.push({ name: slot, key: `${slot}-slot` });
  }
  for (const [items, suffix] of [
    [declaration.cssParts, 'part'],
    [declaration.cssStates, 'state'],
    [declaration.events, 'event'],
  ] as const) {
    for (const { name } of items ?? []) {
      if (name) {
        known.add(name);
        known.add(`${name}-${suffix}`);
      }
    }
  }
  return { bindings, slots, known };
}

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
  return [words.length > 0 ? hole('props', ...words.map(holeWord)) : '', ...fixed]
    .filter(Boolean)
    .join(' ');
}

const doubleNegated = (expression: t.Expression) => {
  const node = unwrapExpression(expression);
  return t.isUnaryExpression(node, { operator: '!' }) &&
    t.isUnaryExpression(node.argument, { operator: '!' })
    ? node.argument.argument
    : undefined;
};

const MUTATORS = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
];

// Whether code changes the args or a name for them, which the snippet's holes could not follow.
function writesArgs(node: t.Node, frame: Frame): boolean {
  const target = t.isAssignmentExpression(node)
    ? node.left
    : t.isUpdateExpression(node) || t.isUnaryExpression(node, { operator: 'delete' })
      ? node.argument
      : t.isCallExpression(node) &&
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.property) &&
          MUTATORS.includes(node.callee.property.name)
        ? node.callee.object
        : undefined;
  if (!target) {
    return false;
  }
  const roots =
    t.isLVal(target) && !t.isMemberExpression(target)
      ? Object.values(t.getBindingIdentifiers(target))
      : [target];
  return roots.some((root) => {
    let item: t.Node = root;
    while (t.isMemberExpression(item) || t.isOptionalMemberExpression(item)) {
      item = item.object;
    }
    return t.isIdentifier(item) && frame.names.has(item.name);
  });
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
