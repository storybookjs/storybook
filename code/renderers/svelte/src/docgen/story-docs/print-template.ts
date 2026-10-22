import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  staticKey,
  textOf,
  unwrapExpression,
  walk as walkEstree,
} from 'storybook/internal/csf-tools';
import { walk } from 'zimmerframe';

import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';
import { type Edit, type Span, applyEdits, parseMarkup, scriptFile, span } from './markup.ts';

// How a template snippet receives the args: `(args)`, `(props)` or `({ label, ...rest })`.
export interface TemplateParameter {
  // The name that holds the args, or the rest of them.
  name?: string;
  // Local name to arg name, for the args the parameter destructures.
  aliases: Record<string, string>;
}

interface Reads {
  args: Record<string, Node>;
  name?: string;
  aliases: Record<string, string>;
  typescript: boolean;
  argsComplete: boolean;
}

// Write a story's args into its markup: spread `{...args}` into attributes, and replace each
// `args.x` read with the source of the arg value.
export function printTemplate({
  code,
  args,
  typescript,
  parameter,
  snippets = {},
  argsComplete = false,
}: {
  code: string;
  args: Record<string, Node>;
  typescript: boolean;
  parameter?: TemplateParameter;
  // Whether `args` holds every arg the story sets, so a read of any other arg is `undefined`.
  argsComplete?: boolean;
  // `{#snippet}` children for the args that hold snippets, written into the component that
  // spreads the args.
  snippets?: Record<string, string>;
}): string {
  const { ast, offset } = parseMarkup(code, typescript);
  const destructured = new Set(Object.values(parameter?.aliases ?? {}));
  const name = parameter ? parameter.name : 'args';
  const reads: Reads = {
    args,
    name,
    aliases: parameter?.aliases ?? {},
    typescript,
    argsComplete,
  };
  const isArgsSpread = (attribute: SvelteAST.Component['attributes'][number]) =>
    attribute.type === 'SpreadAttribute' &&
    attribute.expression.type === 'Identifier' &&
    attribute.expression.name === name;
  const at = (node: object): Span => {
    const range = span(node);
    return { start: range.start - offset, end: range.end - offset };
  };
  const edits: Edit[] = [];

  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    Attribute(node, { path, next }) {
      const element = path.at(-1);
      if (
        node.name in args &&
        element &&
        'attributes' in element &&
        element.attributes.some(
          (attribute: SvelteAST.Component['attributes'][number]) =>
            isArgsSpread(attribute) && attribute.start > node.start
        )
      ) {
        edits.push({ ...at(node), value: `${node.name}={${textOf(args[node.name])}}` });
        return;
      }
      next();
    },
    SpreadAttribute(node, { path, next }) {
      if (!isArgsSpread(node)) {
        next();
        return;
      }
      const element = path.at(-1);
      const content =
        element && 'fragment' in element
          ? (element.fragment as SvelteAST.Fragment).nodes.filter(
              (child) => !(child.type === 'Text' && !child.data.trim())
            )
          : [];
      const written = new Set([
        ...(element && 'attributes' in element
          ? element.attributes.flatMap((attribute: SvelteAST.Component['attributes'][number]) =>
              attribute.type === 'Attribute' || attribute.type === 'BindDirective'
                ? [attribute.name]
                : []
            )
          : []),
        // A snippet block inside a component sets the prop it names; other content sets `children`.
        ...content.map((child) =>
          child.type === 'SnippetBlock' ? child.expression.name : 'children'
        ),
      ]);
      const passed = (key: string) => !written.has(key) && !destructured.has(key);
      const props = Object.entries(args).flatMap(([key, value]) =>
        key in snippets || !passed(key) ? [] : printProp(key, value)
      );
      const spread = spreadEdit(code, at(node), props);
      edits.push(spread);
      const children = Object.entries(snippets).flatMap(([key, snippet]) =>
        passed(key) ? [snippet] : []
      );
      if (!children.length || element?.type !== 'Component') return;
      const { start, end } = at(element);
      if (code.slice(start, end).endsWith('/>')) {
        let from = end - 2;
        while (from > spread.end && /[ \t]/.test(code[from - 1])) from--;
        edits.push({
          start: from,
          end,
          value: `>\n${children.join('\n')}\n</${element.name}>`,
        });
      } else {
        const close = code.lastIndexOf('</', end - 1);
        edits.push({ start: close, end: close, value: `${children.join('\n')}\n` });
      }
    },
    ExpressionTag(node, { path }) {
      const range = at(node.expression);
      const expression = code.slice(range.start, range.end);
      const replaced = replaceArgsReads(expression, reads);
      if (replaced === undefined) return;
      const parent = path.at(-1);
      const text = replaced.text;
      const quoted =
        parent?.type === 'Attribute' && /=\s*["']/.test(code.slice(at(parent).start, range.start));
      if (parent?.type === 'Attribute' && code[at(parent).start] === '{') {
        // `{label}` names the attribute after the variable it reads.
        edits.push({ ...at(parent), value: `${parent.name}={${replaced.value}}` });
      } else if (text !== undefined && quoted && !/[{}]/.test(text)) {
        edits.push({ ...at(node), value: escapeAttribute(text) });
      } else if (text !== undefined && parent?.type === 'Fragment' && !/[{}<>"\\&]/.test(text)) {
        edits.push({ ...at(node), value: text });
      } else {
        edits.push({ ...range, value: replaced.value });
      }
    },
    _(node, { next }) {
      if (node.type === 'ExpressionTag') return next();
      for (const expression of blockExpressions(node)) {
        const range = at(expression);
        const replaced = replaceArgsReads(code.slice(range.start, range.end), reads);
        if (replaced === undefined) continue;
        // `class:active` reads `active`, so a substituted value needs the long form.
        const shorthand =
          'name' in node &&
          node.type.endsWith('Directive') &&
          !code.slice(at(node).start, range.start).includes('=');
        edits.push({
          ...range,
          value: shorthand ? `${node.name}={${replaced.value}}` : replaced.value,
        });
      }
      next();
    },
  });

  return applyEdits(code, edits);
}

function printProp(key: string, value: Node): string[] {
  const node = unwrapExpression(value);
  if (node.type === 'Identifier' && node.name === 'undefined') return [];
  if (node.type === 'Literal' && node.value === true) return [key];
  if (
    node.type === 'Literal' &&
    typeof node.value === 'string' &&
    !/[{}<>"\\&\r\n\t]/.test(node.value)
  ) {
    return [`${key}="${node.value}"`];
  }
  return [`${key}={${textOf(value)}}`];
}

function spreadEdit(code: string, span: Span, props: string[]): Edit {
  const value = props.join(' ').length > 50 ? `\n  ${props.join('\n  ')}\n` : props.join(' ');
  let { start, end } = span;
  if (value.startsWith('\n')) while (start > 0 && /[ \t]/.test(code[start - 1])) start--;
  if (!value) {
    const lineStart = code.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = code.indexOf('\n', end);
    if (
      lineEnd !== -1 &&
      !code.slice(lineStart, start).trim() &&
      !code.slice(end, lineEnd).trim()
    ) {
      start = lineStart;
      end = lineEnd + 1;
    } else if (code[start - 1] === ' ') start--;
  }
  return { start, end, value };
}

// `{#if args.x}`, `{#each args.items as item}`, `{@html args.x}`, `{...fn(args)}` and directive
// values hold expressions outside an `ExpressionTag`. A `bind:` target is not a value, so it stays.
function blockExpressions(node: SvelteAST.SvelteNode): object[] {
  switch (node.type) {
    case 'IfBlock':
      return [node.test];
    case 'EachBlock':
      return [node.expression, ...(node.key ? [node.key] : [])];
    case 'AwaitBlock':
      return [node.expression];
    case 'KeyBlock':
      return [node.expression];
    case 'HtmlTag':
    case 'RenderTag':
    case 'SpreadAttribute':
      return [node.expression];
    // `{@attach}` is newer than the AST types.
    case 'AttachTag' as SvelteAST.SvelteNode['type']:
      return [(node as unknown as { expression: object }).expression];
    case 'ConstTag':
      return node.declaration.declarations.flatMap((declaration) =>
        declaration.init ? [declaration.init] : []
      );
    case 'ClassDirective':
    case 'StyleDirective':
    case 'OnDirective':
    case 'UseDirective':
    case 'TransitionDirective':
    case 'AnimateDirective':
      return node.expression && typeof node.expression === 'object' ? [node.expression] : [];
    default:
      return [];
  }
}

// Replace each read of the story args in an expression with the source of the value it reads, or
// return `undefined` when the expression reads no story args. `text` is set when the expression is
// exactly one read of a string.
function replaceArgsReads(
  expression: string,
  { args, name, aliases, typescript, argsComplete }: Reads
): { value: string; text?: string } | undefined {
  // The parentheses let an object literal or a sequence parse as one expression.
  const editor = new SourceEditor(`(${expression})`, scriptFile(typescript));
  const edits: (Edit & { node?: Node })[] = [];
  // The value of an arg that the template parameter destructures.
  const valueOf = (node: Node): { value: string; node?: Node } | undefined => {
    if (node.type !== 'Identifier' || editor.scopes.bindingOf(node)) return undefined;
    const key = aliases[node.name];
    if (key === undefined) return undefined;
    if (key in args) return printRead(args[key], []);
    return argsComplete ? { value: 'undefined' } : undefined;
  };
  walkEstree(editor.program, (node, parent) => {
    if (node.type === 'MemberExpression') {
      const keys = name === undefined ? undefined : argsPath(node, editor, name);
      if (!keys?.length) return;
      if (!(keys[0] in args)) {
        if (!argsComplete) return;
        edits.push({ start: node.start - 1, end: node.end - 1, value: 'undefined' });
        return false;
      }
      edits.push({
        start: node.start - 1,
        end: node.end - 1,
        ...printRead(args[keys[0]], keys.slice(1)),
      });
      return false;
    }
    if (node.type === 'Property' && node.shorthand && node.value.type === 'Identifier') {
      const read = valueOf(node.value);
      if (!read) return;
      edits.push({
        start: node.start - 1,
        end: node.end - 1,
        value: `${node.value.name}: ${read.value}`,
      });
      return false;
    }
    if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
    const read = valueOf(node);
    if (!read) return;
    edits.push({ start: node.start - 1, end: node.end - 1, ...read });
  });
  if (!edits.length) return undefined;
  const [only] = edits;
  const text =
    edits.length === 1 &&
    expression.slice(0, only.start).trim() === '' &&
    expression.slice(only.end).trim() === '' &&
    only.node?.type === 'Literal' &&
    typeof only.node.value === 'string' &&
    only.node.value.trim()
      ? only.node.value
      : undefined;
  return { value: applyEdits(expression, edits), ...(text !== undefined ? { text } : {}) };
}

// `['a', 'b']` for `args.a.b`, when `args` is the story args and not a local binding.
function argsPath(node: Node, editor: SourceEditor, name: string): string[] | undefined {
  if (node.type === 'Identifier') {
    return node.name === name && !editor.scopes.bindingOf(node) ? [] : undefined;
  }
  if (node.type !== 'MemberExpression') return undefined;
  const parent = argsPath(node.object, editor, name);
  const key = node.computed
    ? node.property.type === 'Literal' &&
      (typeof node.property.value === 'string' || typeof node.property.value === 'number')
      ? String(node.property.value)
      : undefined
    : node.property.type === 'Identifier'
      ? node.property.name
      : undefined;
  return parent && key !== undefined ? [...parent, key] : undefined;
}

// Static members of an object literal print as the value they hold; any other read keeps its
// member access on the value source. `node` is the value when the whole read resolved.
function printRead(value: Node, keys: string[]): { value: string; node?: Node } {
  let node = unwrapExpression(value);
  let rest = keys;
  while (rest.length) {
    const member = memberOf(node, rest[0]);
    if (!member) break;
    node = unwrapExpression(member);
    rest = rest.slice(1);
  }
  const accessors = rest
    .map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`))
    .join('');
  return {
    value: isPrimary(node) ? `${textOf(node)}${accessors}` : `(${textOf(node)})${accessors}`,
    ...(rest.length ? {} : { node }),
  };
}

// The member a static read selects, unless a later spread or computed key may replace it, or it
// is a getter or a method.
function memberOf(node: Node, key: string): Node | undefined {
  if (node.type !== 'ObjectExpression') return undefined;
  for (const property of [...node.properties].reverse()) {
    const name = property.type === 'Property' ? staticKey(property) : undefined;
    if (name === undefined) return undefined;
    if (name === key) {
      const member = property as E.ObjectProperty;
      return member.kind === 'init' && !member.method ? member.value : undefined;
    }
  }
  return undefined;
}

// A value that keeps its meaning wherever an `args.x` read stood, without parentheses. An object
// literal does not: in `() => args.o` it would become a block body.
function isPrimary(node: Node): boolean {
  switch (node.type) {
    case 'Identifier':
    case 'ThisExpression':
    case 'TemplateLiteral':
    case 'ArrayExpression':
    case 'MemberExpression':
    case 'CallExpression':
      return true;
    case 'Literal':
      return typeof node.value !== 'number' || node.value >= 0;
    default:
      return false;
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
