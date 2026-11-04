import type { ESTree as E, ESTreeNode as Node, RenderFunction } from 'storybook/internal/csf-tools';
import { detachedTextOf, isStringLiteral, textOf, walk } from 'storybook/internal/csf-tools';
import { createHoleMarks, printValue } from 'storybook/internal/docs-tools';

import type { HtmlHole, HtmlHolePlace, HtmlSnippetTemplate } from '../../snippet-holes.ts';
import { evaluateArgValue } from './arg-values.ts';

// A story's render function as its snippet: its own code, with each arg it reads, as `args.label`
// or a name its destructured parameter binds, replaced by the arg's value as code, in a `code` hole.
// An expression body prints alone; a block body as the story's function. A read of `args` as a
// whole prints the story's args as an object; such a render has no template, as no hole prints the
// args a control did not change.
//
// `undefined` for a render whose names the snippet cannot fill in: a parameter with a default, a
// rest or a nested pattern, or a body that binds or assigns a name it reads an arg through.
export function renderSnippet(
  render: RenderFunction,
  exportName: string,
  args: Record<string, Node>
): { snippet: string; template: HtmlSnippetTemplate | undefined } | undefined {
  const body = render.body!;
  const reads = argReads(render);
  if (!reads) {
    return undefined;
  }
  // The code of the body, which may be in a file the story imports it from.
  const code = textOf(body);
  // The continuation lines lose the indent of the body's last line, as the line it closes on.
  const indent = /\n([ \t]*)[^\n]*$/.exec(code)?.[1] ?? '';
  const dedent = (text: string) => (indent ? text.replaceAll(`\n${indent}`, '\n') : text);

  const print = (mark?: (hole: HtmlHole, text: string) => string) => {
    let text = '';
    let cursor = 0;
    for (const read of reads) {
      const { before, value, after, hole } = edit(read, args);
      text += dedent(code.slice(cursor, read.node.start - body.start));
      text += before + (mark && hole ? mark(hole, value) : value) + after;
      cursor = read.node.end - body.start;
    }
    text += dedent(code.slice(cursor));
    return body.type === 'BlockStatement'
      ? `const ${exportName} = ${render.async ? 'async ' : ''}() => ${text};`
      : text;
  };

  const snippet = print();
  if (reads.some((read) => read.arg === undefined)) {
    return { snippet, template: undefined };
  }
  const marks = createHoleMarks<HtmlHolePlace>([snippet]);
  return { snippet, template: marks.toTemplate(print(marks.mark)) };
}

// A place the body reads `arg`, or the args as a whole but those in `rest`, as `node`. `shorthand`
// where it is the value of a shorthand property, `{ label }`, and `wrap` where its value needs
// parentheses.
type Read = { node: Node; arg?: string; rest?: string[]; shorthand?: string; wrap: boolean };

function argReads(render: RenderFunction): Read[] | undefined {
  const [param] = render.params;
  const argsName = param?.type === 'Identifier' ? param.name : undefined;
  const pattern: ReturnType<typeof destructuredArgs> =
    param?.type === 'ObjectPattern' ? destructuredArgs(param) : { names: new Map() };
  if (!pattern || (param && !argsName && param.type !== 'ObjectPattern')) {
    return undefined;
  }
  const { names: destructured, rest } = pattern;
  const names = new Set([
    ...destructured.keys(),
    ...(argsName ? [argsName] : []),
    ...(rest ? [rest] : []),
  ]);
  const reads: Read[] = [];
  let rebound = false;

  walk(render.body!, (node, parent) => {
    // Types read no arg, but for the wrappers around an expression.
    if (node.type.startsWith('TS') && !EXPRESSION_WRAPPERS.has(node.type)) {
      return false;
    }
    if (bindsName(node, names)) {
      rebound = true;
    }
    if (isName(node, parent)) {
      return false;
    }
    const arg =
      node.type === 'Identifier'
        ? (destructured.get(node.name) ??
          (node.name === argsName || node.name === rest ? null : undefined))
        : node.type === 'MemberExpression' &&
            node.object.type === 'Identifier' &&
            node.object.name === argsName
          ? memberKey(node)
          : undefined;
    if (arg === undefined) {
      return undefined;
    }
    reads.push({
      node,
      ...(arg !== null && { arg }),
      ...(arg === null &&
        node.type === 'Identifier' &&
        node.name === rest && {
          rest: [...destructured.values()],
        }),
      ...(parent?.type === 'Property' && parent.shorthand && { shorthand: textOf(parent.key) }),
      wrap: needsParentheses(node, parent),
    });
    return false;
  });
  return rebound ? undefined : reads;
}

const EXPRESSION_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSInstantiationExpression',
]);

// The arg each name of a destructured parameter reads, and the name of its rest, or `undefined`
// for a pattern other than plain names, as `{ label, count: n, ...rest }`.
function destructuredArgs(
  pattern: E.ObjectPattern
): { names: Map<string, string>; rest?: string } | undefined {
  const names = new Map<string, string>();
  let rest: string | undefined;
  for (const property of pattern.properties) {
    if (property.type === 'RestElement' && property.argument.type === 'Identifier') {
      rest = property.argument.name;
      continue;
    }
    if (property.type !== 'Property' || property.value.type !== 'Identifier') {
      return undefined;
    }
    const key = property.computed
      ? undefined
      : property.key.type === 'Identifier'
        ? property.key.name
        : isStringLiteral(property.key)
          ? property.key.value
          : undefined;
    if (key === undefined) {
      return undefined;
    }
    names.set(property.value.name, key);
  }
  return { names, rest };
}

// The arg `args.label` or `args['label']` reads.
const memberKey = (node: E.MemberExpression): string | undefined =>
  node.computed
    ? isStringLiteral(node.property)
      ? node.property.value
      : undefined
    : node.property.type === 'Identifier'
      ? node.property.name
      : undefined;

// A member or key name, which reads no arg. A shorthand property's value reads one.
const isName = (node: Node, parent: Node | null) =>
  (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
  (parent?.type === 'Property' && parent.key === node && !parent.computed && parent.value !== node);

// Whether `node` binds or assigns one of `names`, which a read of an arg through it then cannot
// tell from its own.
const bindsName = (node: Node, names: Set<string>): boolean => {
  const targets: Node[] =
    node.type === 'VariableDeclarator'
      ? [node.id]
      : node.type === 'AssignmentExpression'
        ? [node.left]
        : node.type === 'UpdateExpression'
          ? [node.argument]
          : node.type === 'CatchClause' && node.param
            ? [node.param]
            : 'params' in node && Array.isArray(node.params)
              ? (node.params as Node[])
              : [];
  let binds = false;
  targets.forEach((target) =>
    walk(target, (child) => {
      binds ||= child.type === 'Identifier' && names.has(child.name);
    })
  );
  return binds;
};

// Whether a value in place of `node` needs parentheses to keep its meaning, as a number before a
// member, `(5).toFixed()`, a function called, `(() => {})()`, an object an arrow returns,
// `() => ({})`, or a negative number after a minus, `1 - (-2)`.
const needsParentheses = (node: Node, parent: Node | null) =>
  (parent?.type === 'MemberExpression' && parent.object === node) ||
  (parent?.type === 'ArrowFunctionExpression' && parent.body === node) ||
  (parent?.type === 'BinaryExpression' && parent.operator === '-' && parent.right === node) ||
  ((parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
    parent.callee === node) ||
  parent?.type === 'UnaryExpression' ||
  parent?.type === 'UpdateExpression' ||
  (parent?.type === 'BinaryExpression' && parent.operator === '**');

// The code a read is replaced with: the arg's value as code, in a hole for the arg.
function edit(
  read: Read,
  args: Record<string, Node>
): { before: string; value: string; after: string; hole?: HtmlHole } {
  const before = `${read.shorthand ? `${read.shorthand}: ` : ''}${read.wrap ? '(' : ''}`;
  const after = read.wrap ? ')' : '';
  if (read.arg === undefined) {
    const entries = Object.entries(args)
      .filter(([name]) => !read.rest?.includes(name))
      .map(([name, node]) => `${printKey(name)}: ${valueCode(name, node)}`);
    return { before, value: `{ ${entries.join(', ')} }`, after };
  }
  return {
    before,
    value: valueCode(read.arg, args[read.arg]),
    after,
    hole: { kind: 'code', arg: read.arg },
  };
}

// An arg's value as code, as `printHole` prints it, or as the story writes it where the server
// cannot read it.
const valueCode = (name: string, node: Node | undefined): string => {
  const value = node ? evaluateArgValue(node) : { kind: 'unset' as const };
  return value.kind === 'value'
    ? printValue(value.value, name, { quote: "'" })
    : value.kind === 'unset' || !node
      ? 'undefined'
      : detachedTextOf(node);
};

const printKey = (name: string) =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : printValue(name, name, { quote: "'" });
