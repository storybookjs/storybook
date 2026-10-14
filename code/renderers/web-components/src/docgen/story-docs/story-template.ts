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

import { parseArgKey } from '../../arg-keys.ts';
import { fillTemplate } from '../../docs/fill-template.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { evaluateArgValue } from './arg-values.ts';
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
  declarationOf,
  paramFrame,
  renderFrame,
  resolveBinding,
  resolveTemplate,
  writesLitHtml,
} from './template-calls.ts';

/**
 * The component's element and, where known, its manifest declaration and the args the story sets.
 * `guess` holds the {@link argsWords} a spread passes, as Storybook's render would set them, for a
 * static snippet that reads like the html of a story without a spread; it may name what another
 * file declares, as no other args fill it.
 */
export interface SpreadElement {
  tag: string;
  declaration?: ManifestDeclaration;
  args?: string[];
  guess?: string[];
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
// the listeners that read an arg, which the snippet leaves out. `work` is what writing may still
// visit, shared by all of it, and `scope` the names the code written around this point binds, with
// the frame owner whose code binds each; `root` is the module the template is read in.
interface Writing {
  depth: number;
  element: SpreadElement;
  open: Set<t.Node>;
  markup: boolean;
  listeners: string[];
  work: { left: number };
  scope: Map<string, object>;
  root: TemplateModule;
}

const MAX_DEPTH = 16;
// Enough for the largest stories of real projects many times over, and a few milliseconds.
const MAX_WORK = 200_000;

/**
 * `<tag ⟦props …⟧></tag>` for a story without a render function: each arg as Storybook's render
 * applies it, an attribute, property or custom property in the tag, a slot as content, and a part
 * or state style in a `<style>` before it.
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
  for (const arg of new Set([...storyArgs, ...Object.keys(argTypes)])) {
    const binding = classifyArg(arg, false, argTypes, declaration);
    const parsed = binding.kind === 'unknown' ? parseArgKey(arg) : undefined;
    const kind = parsed ? CATEGORY_KINDS[parsed.category] : binding.kind;
    const name = parsed?.name ?? ('name' in binding ? binding.name : arg);
    switch (kind) {
      case 'attribute':
        props.push(`${binding.kind === 'attribute' && binding.viaField ? '~' : ''}${name}=${arg}`);
        break;
      case 'cssProperty':
        props.push(`${name}=${arg}`);
        break;
      case 'property':
      case 'unknown':
        props.push(`.${name}=${arg}`);
        break;
      case 'slot':
        slots.push(hole('slot', holeWord(name), holeWord(arg)));
        break;
      case 'cssPart':
        styles.push(`::part(${name})=${arg}`);
        break;
      case 'cssState':
        styles.push(`:state(${name})=${arg}`);
        break;
      default:
        break;
    }
  }
  const style = styles.length > 0 ? hole('style', tag, ...styles.map(holeWord)) : '';
  return `${style}<${tag} ${hole('props', ...props.map(holeWord))}>${slots.join('')}</${tag}>`;
}

/** The `binding=arg` word of each arg that sets an attribute, property or CSS property. */
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
  const writing: Writing = {
    depth: 0,
    element,
    open: new Set(),
    markup: false,
    listeners: [],
    work: { left: MAX_WORK },
    scope: new Map(),
    root: module,
  };
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
  if (!text || !hasHoleBracket(text) || writing.work.left <= 0) {
    return undefined;
  }
  // The html starts after the backtick, mostly on a new line whose indentation the others share.
  const column = /^\s*\n([ \t]*)/.exec(text)?.[1]!.length;
  return { template: dedentStoryCode(text.trim(), column), listeners: writing.listeners };
}

// Takes one step of the work writing may do; a template that would take more is not written.
const spend = (writing: Writing) => --writing.work.left > 0;

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
        // After the branch, where no code before them could run into the next.
        const guards = known.guards.map((arg) => hole('props', holeWord(`^${arg}`))).join('');
        return branch === undefined ? undefined : branch + guards;
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

function writeMarkup({ quasis, expressions, frame }: Markup, writing: Writing): string | undefined {
  if (writesHoleBracket(frame.module) || !spend(writing)) {
    return undefined;
  }
  // A function that keeps calling itself has no html to write; trying it some other way would not
  // either.
  if (writing.depth > MAX_DEPTH) {
    writing.work.left = 0;
    return undefined;
  }
  writing = { ...writing, depth: writing.depth + 1 };
  const state: HtmlState = { in: 'text', tag: '' };
  const out: string[] = [];
  // Drops the whitespace written last, as an attribute left out takes the space before it along.
  const trimOut = () => {
    while (out.length > 0 && out.at(-1)!.trim() === '') {
      out.pop();
    }
    out.push(out.pop()?.trimEnd() ?? '');
  };
  let text = quasis[0]!;
  readHtml(state, text);
  for (const [index, expression] of expressions.entries()) {
    const quasi = quasis[index]!;
    let next = quasis[index + 1]!;
    // A boolean binding reads only whether its value is truthy, so `!!value` binds what `value` does.
    const truthy = /\?[^\s"'<>/=]+="?$/.test(quasi) ? doubleNegated(expression) : undefined;
    const bound = resolveBinding(truthy ?? expression, frame);
    const arg = bound?.kind === 'arg' && bound.path.length === 0 ? bound : undefined;
    let read: { code: string | undefined } | undefined;
    const value = () => (read ??= { code: valueText(expression, frame, writing) }).code;
    const inTag = state.in !== 'text' && !state.raw;
    // `name=${…}`, `name="${…}"`, `?name=${…}` or `.name=${…}`, after the tag name or an attribute.
    const binding = inTag ? /(?<=\s)([?@.]?)([^\s"'<>/=.?@][^\s"'<>/=]*)=("?)$/.exec(quasi) : null;
    // The whole value, which ends where the quote does or, unquoted, before a space or the tag end.
    const whole = binding && (binding[3] ? next.startsWith(binding[3]) : /^(\s|\/?>)/.test(next));
    let part: string | undefined;
    if (binding && whole) {
      const [all, prefix, name, quote] = binding;
      const kind = prefix === '?' ? 'bool' : prefix === '.' ? 'prop' : 'attr';
      // An event binding that reads an arg passes a listener, which the snippet leaves out.
      const listener = prefix === '@' && (value() === undefined || hasHoleBracket(value()!));
      if (listener) {
        writing.listeners.push(name!);
      }
      const attribute = listener
        ? ''
        : arg
          ? kind === 'prop' && !arg.fallback
            ? hole(
                kind,
                holeWord(name!),
                holeWord(arg.name),
                ...unsetProperty(name!, state, writing)
              )
            : argHole(kind, [name!, arg.name], arg.fallback, writing)
          : bound?.kind === 'value' && prefix !== '@'
            ? printed(hole(kind, name!, 'value'), bound.value)
            : undefined;
      if (attribute !== undefined) {
        text = text.slice(0, -all.length);
        if (attribute) {
          text += attribute;
        } else {
          out.push(text);
          text = '';
          trimOut();
        }
        next = next.slice(quote!.length);
      } else if (arg || value() === undefined) {
        return undefined;
      } else {
        part = `\${${value()}}`;
      }
    } else if (
      inTag &&
      (state.in !== 'tag' || binding) &&
      /(?<=\s)[^\s"'<>/=?.@][^\s"'<>/=]*=["']?[^"']*$/.test(state.tag) &&
      (arg || bound?.kind === 'value')
    ) {
      // A value inside a larger attribute value, which lit writes as text in it.
      const inside = arg
        ? arg.fallback
          ? undefined
          : hole('quoted', holeWord(arg.name), ...(state.in === "'" ? ["'"] : []))
        : printed(
            hole('quoted', 'value', ...(state.in === "'" ? ["'"] : [])),
            (bound as { value: unknown }).value
          );
      if (inside === undefined) {
        return undefined;
      }
      if (state.in === 'tag') {
        // An unquoted value gets quotes, which end it where the html ends it.
        const end = next.search(/\s|\/?>/);
        if (end === -1) {
          return undefined;
        }
        text += '"';
        next = `${next.slice(0, end)}"${next.slice(end)}`;
      }
      part = inside;
    } else if (inTag) {
      const spread = spreadText(
        expression,
        frame,
        writtenNames(`${state.tag} ${tagRest(quasis.slice(index + 1))}`),
        writing
      );
      if (spread === undefined && value() === undefined) {
        return undefined;
      }
      // `@open-wc/lit-helpers` binds a spread to an attribute named `...`.
      if (spread !== undefined) {
        text = text.replace(/\s\.\.\.=$/, ' ');
      }
      if (spread === undefined) {
        part = `\${${value()}}`;
      } else if (spread) {
        part = spread;
      } else {
        out.push(text);
        text = '';
        trimOut();
      }
    } else if (arg) {
      part = argHole(state.raw ? 'raw' : 'text', [arg.name], arg.fallback, writing);
      if (part === undefined) {
        return undefined;
      }
    } else if (bound?.kind === 'value') {
      part = printed(hole(state.raw ? 'raw' : 'text', 'value'), bound.value);
      if (part === undefined) {
        return undefined;
      }
    } else {
      // A function called with the args whole, or a name for html, is written in place.
      const named =
        t.isIdentifier(unwrapExpression(expression)) ||
        takesArgs(unwrapExpression(expression), frame) ||
        value() === undefined;
      const nested = named ? resolveTemplate(expression, frame) : undefined;
      part = nested ? writeTemplate(nested, writing, 'child') : value() && `\${${value()}}`;
      if (part === undefined) {
        return undefined;
      }
    }
    out.push(text, part ?? '');
    text = next;
    readHtml(state, quasis[index + 1]!);
  }
  out.push(text);
  return out.join('');
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
  if (writesHoleBracket(frame.module) || !spend(writing)) {
    return undefined;
  }
  const names = new Set(frame.names.keys());
  const declared = declaredNames(expression);
  // What is written inside this code sees the names it binds.
  const inner: Writing = { ...writing, scope: new Map(writing.scope) };
  declared.forEach((name) => inner.scope.set(name, frame.owner));
  const edits: { start: number; end: number; text: string }[] = [];
  const replace = (node: t.Node, text: string | undefined) => {
    edits.push({ start: node.start!, end: node.end!, text: text ?? '' });
    return text !== undefined;
  };
  // Html written in a body from another place is indented as the line it is written on.
  const inline = (node: t.Node, text: string | undefined) =>
    replace(node, writing.markup && text ? indentAs(text, lineIndent(code, node.start!)) : text);
  const visit = (node: t.Node, ancestors: t.Node[] = []): boolean => {
    if (!spend(writing)) {
      return false;
    }
    if (dropped.has(node)) {
      // The line a dropped statement is on goes with it.
      const start =
        node.start! -
        /[ \t]*$/.exec(code.slice(lineStart(code, node.start!), node.start!))![0].length;
      const end = node.end! + /^[ \t]*\n?/.exec(code.slice(node.end!, node.end! + 200))![0].length;
      edits.push({ start, end, text: '' });
      return true;
    }
    if (writesArgs(node, frame)) {
      return false;
    }
    if (writing.markup && t.isTaggedTemplateExpression(node)) {
      const template = resolveTemplate(node, frame);
      if (template) {
        return inline(node, writeTemplate(template, inner, 'code'));
      }
    }
    // A call that takes the args whole is written as the html it returns, where it has any.
    if (ancestors.length > 0 && takesArgs(node, frame)) {
      const template = resolveTemplate(node as t.CallExpression, frame);
      const html = template && writeTemplate(template, inner, 'code');
      if (html !== undefined) {
        return inline(node, html);
      }
    }
    const bound = t.isExpression(node) ? resolveBinding(node, frame) : undefined;
    const operand = isOperand(node, ancestors);
    // Args passed whole to code the html keeps as written are printed as an object; a statement
    // may write them.
    if (
      bound?.kind === 'args' &&
      bound.open &&
      bound.entries.size === 0 &&
      !ancestors.some((item) => t.isStatement(item) || t.isVariableDeclarator(item))
    ) {
      const left = [...bound.omitted].map((name) => holeWord(`-${name}`));
      return replace(node, operand ? `(${hole('args', ...left)})` : hole('args', ...left));
    }
    if (bound?.kind === 'arg' && (bound.path.length === 0 || t.isIdentifier(node))) {
      const kind = operand || bound.path.length > 0 ? 'operand' : 'value';
      const read = argHole(kind, [bound.name], bound.fallback, inner);
      return replace(node, read && read + bound.path.map(memberText).join(''));
    }
    if (bound?.kind === 'value') {
      const printed = printValue(bound.value, '');
      return replace(node, operand ? asOperand(printed) : printed);
    }
    if (bound?.kind === 'code') {
      if (writing.open.has(bound.expression)) {
        return false;
      }
      writing.open.add(bound.expression);
      const written = valueText(bound.expression, bound.frame, inner);
      writing.open.delete(bound.expression);
      const whole = ancestors.length === 0 || isPrimary(bound.expression);
      return inline(node, written && (whole ? written : `(${written})`));
    }
    // A name written here must name what it names where the code was written.
    if (
      t.isIdentifier(node) &&
      !bound &&
      !declared.has(node.name) &&
      namesOther(node.name, frame, writing)
    ) {
      // A constant another file declares is written as its value, where it has a literal or is
      // html.
      const literal = constantText(node.name, frame);
      if (literal !== undefined) {
        return replace(node, operand ? asOperand(literal) : literal);
      }
      const declaration = declarationOf(frame.module, node.name);
      const template =
        declaration &&
        t.isExpression(declaration.node) &&
        resolveTemplate(declaration.node, {
          module: declaration.module,
          names: new Map(),
          owner: {},
        });
      return !!template && inline(node, writeTemplate(template, inner, 'code'));
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
    edits.length = written;
    const template = resolveTemplate(node, frame);
    return inline(node, template && writeTemplate(template, inner, 'code'));
  };
  if (!visit(expression)) {
    return undefined;
  }
  const parts: string[] = [];
  let at = expression.start!;
  for (const edit of edits.sort((a, b) => a.start - b.start)) {
    parts.push(code.slice(at, edit.start), edit.text);
    at = edit.end;
  }
  parts.push(code.slice(at, expression.end!));
  return parts.join('');
}

// The literal of a constant a module declares, such as `const DEFAULT = 'Untitled'`.
function constantText(name: string, frame: Frame): string | undefined {
  const declared = declarationOf(frame.module, name);
  const value = declared && evaluateArgValue(declared.node);
  if (value?.kind !== 'value') {
    return undefined;
  }
  try {
    return printValue(value.value, name);
  } catch {
    return undefined;
  }
}

// Whether a call passes the args whole, or a copy of them, to the function it calls.
const takesArgs = (node: t.Node, frame: Frame) =>
  t.isCallExpression(node) && node.arguments.some((argument) => copiesArgs(argument, frame));

const copiesArgs = (node: t.Node, frame: Frame): boolean =>
  resolveBinding(node, frame)?.kind === 'args' ||
  (t.isObjectExpression(node) &&
    node.properties.some((item) => t.isSpreadElement(item) && copiesArgs(item.argument, frame)));

/**
 * Whether a name that code from `frame` reads, which it does not bind itself, would name something
 * else where it is written: a name the code around it binds, or a name the story's module declares
 * other than the module the code is from.
 */
function namesOther(name: string, frame: Frame, writing: Writing): boolean {
  const owner = writing.scope.get(name);
  if (owner !== undefined && owner !== frame.owner) {
    return true;
  }
  const { root } = writing;
  if (frame.module === root) {
    return false;
  }
  // A name another file of the project declares must name it in the story file as well; a
  // package's export reads the same anywhere.
  const there = frame.module.bindings.get(name);
  const own = topLevelNames(frame.module).has(name) && (!there || /^[./]/.test(there.importId));
  if (!topLevelNames(root).has(name)) {
    return own && !writing.element.guess;
  }
  // The story file may import the very constant or function the code names.
  const [declared, used] = [declarationOf(root, name), declarationOf(frame.module, name)];
  if (declared && used) {
    return declared.node !== used.node;
  }
  const here = root.bindings.get(name);
  if (!here || !there || here.importName !== there.importName) {
    return true;
  }
  const [a, b] = [root.resolveModule(here.importId), frame.module.resolveModule(there.importId)];
  return a || b ? a?.program !== b?.program : here.importId !== there.importId;
}

const topLevel = new WeakMap<TemplateModule, Set<string>>();

// The names a module declares or imports at its top level.
function topLevelNames(module: TemplateModule): Set<string> {
  let names = topLevel.get(module);
  if (!names) {
    names = new Set(module.bindings.keys());
    for (const statement of module.program.body) {
      const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement;
      if (t.isDeclaration(declaration) && !t.isImportDeclaration(declaration)) {
        Object.keys(t.getBindingIdentifiers(declaration)).forEach((name) => names!.add(name));
      }
    }
    topLevel.set(module, names);
  }
  return names;
}

const holeBrackets = new WeakMap<TemplateModule, boolean>();

// The code has a hole bracket of its own, so holes written in it could not be found again.
function writesHoleBracket(module: TemplateModule): boolean {
  let found = holeBrackets.get(module);
  if (found === undefined) {
    found = hasHoleBracket(module.code);
    holeBrackets.set(module, found);
  }
  return found;
}

const lineStart = (code: string, offset: number) => code.lastIndexOf('\n', offset - 1) + 1;

function lineIndent(code: string, offset: number): string {
  const indent = /[ \t]*/y;
  indent.lastIndex = lineStart(code, offset);
  return indent.exec(code)![0];
}

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
// lit sets a property to `undefined` while its arg is unset, which only shows on a field the element
// gives a default.
function unsetProperty(name: string, state: HtmlState, writing: Writing): string[] {
  const { tag, declaration } = writing.element;
  const field =
    /^<([^\s/>]+)/.exec(state.tag)?.[1] === tag
      ? declaration?.members?.find((member) => member.kind === 'field' && member.name === name)
      : undefined;
  const value = field && 'default' in field ? field.default : undefined;
  return value === undefined || value === 'undefined'
    ? []
    : [defaultWord(`.${name}=\${undefined}`)];
}

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
    return ['attr', 'bool', 'prop'].includes(kind)
      ? printed(hole(kind, name, 'value'), fallback.value)
      : printed(hole(kind, 'value'), fallback.value);
  }
  const code = valueText(fallback.expression, fallback.frame, writing);
  if (code === undefined) {
    return undefined;
  }
  switch (kind) {
    case 'value':
    case 'operand':
      return isPrimary(fallback.expression) ? code : `(${code})`;
    case 'attr':
    case 'bool':
    case 'prop':
      return `${kind === 'bool' ? '?' : kind === 'prop' ? '.' : ''}${name}=\${${code}}`;
    default:
      return `\${${code}}`;
  }
}

// A hole filled with a value the story's code holds, or `undefined` for one it cannot print.
function printed(template: string, value: unknown): string | undefined {
  try {
    return fillTemplate(template, { value });
  } catch {
    return undefined;
  }
}

/**
 * The element `template(args, slot)` of `@wc-toolkit/storybook-helpers` renders: a `<style>` with
 * the CSS properties, part and state styles, then the element, which its own `spread` gives each
 * attribute, boolean attribute and field the manifest declares and every other arg as an attribute,
 * with the slots as content.
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
  const { bindings, slots, styles, known } = toolkitArgs(declaration);
  for (const key of passed.entries.keys()) {
    if (!known.has(key) && !key.startsWith('on')) {
      bindings.push({ binding: key, key });
    }
  }
  const entryOf = (key: string): Binding | undefined =>
    asValue(passed.entries.get(key)) ??
    (passed.open && !passed.omitted.has(key) ? { kind: 'arg', name: key, path: [] } : undefined);
  const words = ['!toolkit', ...(passed.open ? ['*'] : [])];
  // Every arg the manifest names is left to its own word, and the others to `*`.
  for (const key of new Set([...known, ...passed.entries.keys(), ...passed.omitted])) {
    words.push(`-${encodeURIComponent(key)}`);
  }
  const written: string[] = [];
  for (const { binding, key } of bindings) {
    const entry = entryOf(key);
    if (!entry) {
      continue;
    }
    if (entry.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      words.push(`${binding}=${entry.name}`);
    } else if (entry.kind === 'value') {
      const text = printed(hole('props', '!toolkit', holeWord(`${binding}=value`)), entry.value);
      if (text === undefined) {
        return undefined;
      }
      written.push(text);
    } else if (entry.kind === 'code') {
      const code = valueText(entry.expression, entry.frame, writing);
      if (code === undefined) {
        return undefined;
      }
      written.push(`${binding}=\${${code}}`);
    } else {
      return undefined;
    }
  }
  const style: string[] = [];
  for (const { selector, key } of styles) {
    const entry = entryOf(key);
    if (entry?.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      style.push(`${selector}=${entry.name}`);
    } else if (entry && !(entry.kind === 'value' && entry.value === undefined)) {
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
  const start = [tag, hole('props', ...words.map(holeWord)), ...written.filter(Boolean)].join(' ');
  const styleHole = style.length > 0 ? hole('style', tag, ...style.map(holeWord)) : '';
  return `${styleHole}<${start}>${content.join('')}</${tag}>`;
}

// The html `@wc-toolkit/storybook-helpers` renders for a slot's value: each element of html for a
// named slot gets `slot`, and its text a `<span slot>` of its own.
function slotHtml(name: string, value: unknown): string | undefined {
  if (name === 'default' || typeof value !== 'string' || !/[<&]/.test(value)) {
    return printed(hole('slot', holeWord(name), 'value'), value);
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
  return nodes.every((node) => node !== undefined)
    ? printed(hole('slot', 'default', 'value'), nodes.join(''))
    : undefined;
}

// What `@wc-toolkit/storybook-helpers` reads from the manifest: the binding of each attribute and
// field with the arg that sets it, the CSS properties, part and state styles, the slots, and every
// arg name it knows.
function toolkitArgs(declaration: ManifestDeclaration) {
  const bindings: { binding: string; key: string }[] = [];
  const styles: { selector: string; key: string }[] = [];
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
      bindings.push({ binding: `${bool ? '?' : ''}${attribute.name}`, key: attribute.name });
    }
    // A field whose attribute has another name is a property arg as well.
    if ((!attribute || attribute.name !== member.name) && !member.name.startsWith('on')) {
      bindings.push({ binding: `.${member.name}`, key: member.name });
    }
  }
  for (const { name } of declaration.cssProperties ?? []) {
    known.add(name);
    styles.push({ selector: name, key: name });
  }
  for (const [items, suffix] of [
    [declaration.cssParts, 'part'],
    [declaration.cssStates, 'state'],
  ] as const) {
    for (const { name } of items ?? []) {
      if (name) {
        known.add(name);
        known.add(`${name}-${suffix}`);
        styles.push({
          selector: suffix === 'part' ? `::part(${name})` : `:state(${name})`,
          key: `${name}-${suffix}`,
        });
      }
    }
  }
  for (const { name } of declaration.slots ?? []) {
    const slot = name || 'default';
    known.add(slot);
    known.add(`${slot}-slot`);
    slots.push({ name: slot, key: `${slot}-slot` });
  }
  for (const { name } of declaration.events ?? []) {
    if (name) {
      known.add(name);
      known.add(`${name}-event`);
    }
  }
  return { bindings, styles, slots, known };
}

// The directives of `@open-wc/lit-helpers` that pass an object along to the element they sit on.
const SPREADS = ['spread', 'spreadProps', 'spreadEvents'];

// Which of them a callee is: one imported from the package, or a `spreadProps` of the project,
// which sets each key as a property as the package's does.
function spreadKind(callee: t.Node, frame: Frame): string | undefined {
  const imported = t.isIdentifier(callee) ? frame.module.bindings.get(callee.name) : undefined;
  if (imported?.importId === '@open-wc/lit-helpers' && SPREADS.includes(imported.importName)) {
    return imported.importName;
  }
  return calleeName(callee, frame) === 'spreadProps' ? 'spreadProps' : undefined;
}

// An object written with fixed values only, such as `{ style: 'currency' }`, is that value.
function asValue(binding: Binding): Binding;
function asValue(binding: Binding | undefined): Binding | undefined;
function asValue(binding: Binding | undefined): Binding | undefined {
  if (binding?.kind !== 'args' || binding.open || binding.omitted.size > 0) {
    return binding;
  }
  const value: Record<string, unknown> = {};
  for (const [key, entry] of binding.entries) {
    const known = asValue(entry);
    if (known?.kind !== 'value') {
      return binding;
    }
    value[key] = known.value;
  }
  return { kind: 'value', value };
}

// What `${spread(args)}` in a tag passes to the element: a props hole, or nothing for listeners.
function spreadText(
  expression: t.Expression,
  frame: Frame,
  written: string[],
  writing: Writing
): string | undefined {
  const call = unwrapExpression(expression);
  const kind = t.isCallExpression(call) ? spreadKind(call.callee, frame) : undefined;
  if (kind !== 'spreadEvents' && writing.element.guess && t.isCallExpression(call)) {
    return guessedSpreadText(call, frame, written, writing.element.guess);
  }
  if (!kind || !t.isCallExpression(call)) {
    return undefined;
  }
  const [passed, ...more] = call.arguments;
  const args = passed && resolveBinding(passed, frame);
  if (args?.kind !== 'args' || !args.open || more.length > 0) {
    return undefined;
  }
  if (kind === 'spreadEvents') {
    writing.listeners.push(frame.module.code.slice(call.start!, call.end!));
    return '';
  }
  return propsText(kind, args, written);
}

// The props hole of a spread, with what the call wrote over the args next to it. An arg the tag
// writes as well gets a `^arg` word: while it is set, which of the two the element shows is not
// known.
function propsText(kind: string, args: ArgsBinding, written: string[]): string | undefined {
  const words = [`!${kind}`, '*'];
  const fixed: string[] = [];
  for (const key of new Set([...args.omitted, ...args.entries.keys()])) {
    words.push(`-${encodeURIComponent(key)}`);
  }
  for (const [key, passed] of args.entries) {
    const entry = asValue(passed);
    const binding = kind === 'spreadProps' ? `.${key}` : key;
    if (entry.kind === 'value') {
      const text = printed(hole('props', `!${kind}`, holeWord(`${binding}=value`)), entry.value);
      if (text === undefined) {
        return undefined;
      }
      fixed.push(text);
    } else if (entry.kind === 'arg' && entry.path.length === 0 && !entry.fallback) {
      words.push(`${binding}=${entry.name}`);
    } else {
      return undefined;
    }
  }
  words.push(...written.map((name) => `^${name}`));
  return [hole('props', ...words.map(holeWord)), ...fixed].filter(Boolean).join(' ');
}

// A spread of the project's own, read as Storybook's render sets the args, with the names a second
// argument leaves out.
function guessedSpreadText(
  call: t.CallExpression,
  frame: Frame,
  written: string[],
  guess: string[]
): string | undefined {
  const name = calleeName(call.callee, frame);
  const [passed, excluded, ...more] = call.arguments;
  const args = passed && resolveBinding(passed, frame);
  const left = t.isArrayExpression(excluded)
    ? excluded.elements.map((item) => (t.isStringLiteral(item) ? item.value : undefined))
    : [];
  if (
    !name ||
    !SPREADS.includes(name) ||
    args?.kind !== 'args' ||
    !args.open ||
    more.length > 0 ||
    (excluded && !t.isArrayExpression(excluded)) ||
    left.includes(undefined)
  ) {
    return undefined;
  }
  if (name === 'spreadEvents') {
    return '';
  }
  const fixed: string[] = [];
  const words: string[] = [];
  for (const word of guess) {
    const [binding = '', arg = ''] = word.split(/=(.*)/);
    const entry = asValue(args.entries.get(arg));
    const collides = written.includes(
      binding.startsWith('--') ? 'style' : binding.replace('.', '')
    );
    if (left.includes(arg) || args.omitted.has(arg)) {
      continue;
    }
    if (!entry) {
      words.push(collides ? `^${arg}` : word);
    } else if (entry.kind === 'value' && !collides) {
      const text = printed(hole('props', holeWord(`${binding}=value`)), entry.value);
      if (text === undefined) {
        return undefined;
      }
      fixed.push(text);
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

// Calls that write into the object their first argument is.
const OBJECT_WRITERS: Record<string, string[]> = {
  Object: ['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'],
  Reflect: ['set', 'defineProperty', 'deleteProperty', 'setPrototypeOf'],
};

// Whether code changes the args or a name for them, which the snippet's holes could not follow.
function writesArgs(node: t.Node, frame: Frame): boolean {
  const callee =
    t.isCallExpression(node) && t.isMemberExpression(node.callee) ? node.callee : undefined;
  const method =
    callee && !callee.computed && t.isIdentifier(callee.property) ? callee.property.name : '';
  const target = t.isAssignmentExpression(node)
    ? node.left
    : t.isUpdateExpression(node) || t.isUnaryExpression(node, { operator: 'delete' })
      ? node.argument
      : callee && MUTATORS.includes(method)
        ? callee.object
        : callee &&
            t.isIdentifier(callee.object) &&
            !frame.names.has(callee.object.name) &&
            OBJECT_WRITERS[callee.object.name]?.includes(method)
          ? (node as t.CallExpression).arguments[0]
          : undefined;
  if (!target) {
    return false;
  }
  const roots =
    t.isLVal(target) && !t.isMemberExpression(target)
      ? Object.values(t.getBindingIdentifiers(target))
      : [target];
  return roots.some((root) => {
    let item: t.Node = unwrapExpression(root);
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

const declared = new WeakMap<t.Node, Set<string>>();

// The names the functions and declarations inside code bind.
function declaredNames(node: t.Node): Set<string> {
  let names = declared.get(node);
  if (!names) {
    names = new Set([
      ...(t.isFunction(node) ? node.params : t.isVariableDeclarator(node) ? [node.id] : []).flatMap(
        (bound) => Object.keys(t.getBindingIdentifiers(bound))
      ),
      ...(t.isFunctionDeclaration(node) && node.id ? [node.id.name] : []),
      ...children(node).flatMap((child) => [...declaredNames(child)]),
    ]);
    declared.set(node, names);
  }
  return names;
}

const namesAny = (node: t.Node, names: Set<string>): boolean =>
  names.size > 0 &&
  (t.isIdentifier(node)
    ? names.has(node.name)
    : children(node).some((child) => namesAny(child, names)));

const bindsName = (param: t.Node, names: Set<string>) =>
  Object.keys(t.getBindingIdentifiers(param)).some((name) => names.has(name));
