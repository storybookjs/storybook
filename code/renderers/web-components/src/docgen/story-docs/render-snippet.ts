import type {
  CsfFile,
  ESTree as E,
  ESTreeNode as Node,
  ImportBinding,
  RenderFunction,
} from 'storybook/internal/csf-tools';
import {
  collectImportBindings,
  detachedTextOf,
  isStringLiteral,
  textOf,
  walk,
} from 'storybook/internal/csf-tools';
import { createHoleMarks, printValue } from 'storybook/internal/docs-tools';

import {
  type ArgRead,
  type HtmlHole,
  type HtmlHolePlace,
  type HtmlSnippetTemplate,
  attrHole,
} from '../../snippet-holes.ts';
import {
  boundText,
  childText,
  escapeAttribute,
  escapeText,
  quotedAttribute,
  templateText,
} from '../../snippet-values.ts';
import { evaluateArgValue } from './arg-values.ts';

// A story's render function as its snippet: its own code, with each arg it reads filled in. A read
// that is the whole value of an attribute, text in a quoted attribute value, or text of a lit
// template prints as that text; any other read, as in a call or a property binding, prints as the
// value's code. An expression body prints alone; a block body as the story's function.
//
// The template has a hole for each read. A read of the whole `args` object prints the story's args
// as an object, with a `guard` hole for each arg, as no hole prints the args a control did not set.
export function renderSnippet(
  render: RenderFunction,
  csf: CsfFile,
  exportName: string,
  args: Record<string, Node>,
  argNames: string[]
): { snippet: string; template: HtmlSnippetTemplate | undefined } {
  const body = render.body!;
  // The code of the body, which may be in a file the story imports it from.
  const code = textOf(body);
  const reads = argReads(render, collectImportBindings(csf.program), { code, start: body.start });
  const edits = reads.map((read) => edit(read, args));
  const guarded = reads.some((read) => read.kind === 'whole') ? argNames : [];
  const indent = Math.min(
    ...code
      .split('\n')
      .slice(1)
      .filter((line) => line.trim() !== '')
      .map((line) => /^[ \t]*/.exec(line)![0].length)
  );

  const print = (mark?: (hole: HtmlHole, text: string) => string) => {
    let text = '';
    let cursor = 0;
    for (const { start, end, text: value, hole } of edits) {
      text += code.slice(cursor, start - body.start) + (mark && hole ? mark(hole, value) : value);
      cursor = end - body.start;
    }
    text += code.slice(cursor);
    // The continuation lines lose the indent they share.
    const dedented = Number.isFinite(indent)
      ? text.replace(new RegExp(`\n[ \t]{${indent}}`, 'g'), '\n')
      : text;
    return body.type === 'BlockStatement'
      ? `const ${exportName} = ${render.async ? 'async ' : ''}() => ${dedented};`
      : dedented;
  };

  const snippet = print();
  const marks = createHoleMarks<HtmlHolePlace>([snippet]);
  const guards = guarded.map((arg) => marks.mark({ kind: 'guard', arg }, '')).join('');
  return { snippet, template: marks.toTemplate(guards + print(marks.mark)) };
}

// A place the render function reads an arg: `node` is the code it replaces.
type Read =
  | { kind: 'arg'; node: Node; read: ArgRead; place: Place }
  | { kind: 'whole'; node: Node };

// Where a read stands in a template literal: the whole value of the attribute `name`, text in a
// quoted attribute value, text of a lit template, or of a plain one; or anywhere else, as code.
type Place =
  | { kind: 'attr'; name: string; span: Span }
  | { kind: 'quoted' | 'text' | 'html'; span: Span }
  | { kind: 'code' };
type Span = { start: number; end: number };

// The reads of args in the body of `render`: of a member of its parameter, as `args.label`, of a
// name a destructured parameter binds, or of the parameter as a whole.
function argReads(
  render: RenderFunction,
  bindings: Map<string, ImportBinding>,
  source: { code: string; start: number }
): Read[] {
  const [param] = render.params;
  const argsName = param?.type === 'Identifier' ? param.name : undefined;
  const destructured =
    param?.type === 'ObjectPattern' ? destructuredArgs(param, []) : new Map<string, ArgRead>();
  const parents = new Map<Node, Node | null>();
  const reads: Read[] = [];

  walk(render.body!, (node, parent) => {
    parents.set(node, parent);
    if (isName(node, parent)) {
      return false;
    }
    const chain = memberChain(node);
    if (!chain) {
      return undefined;
    }
    const { root, keys } = chain;
    const base =
      argsName !== undefined && root.name === argsName
        ? keys.length > 0
          ? { arg: keys[0]!, path: keys.slice(1) }
          : undefined
        : destructured.get(root.name) && {
            arg: destructured.get(root.name)!.arg,
            path: [...(destructured.get(root.name)!.path ?? []), ...keys],
          };
    if (argsName !== undefined && root.name === argsName && keys.length === 0) {
      reads.push({ kind: 'whole', node });
      return false;
    }
    if (!base) {
      return undefined;
    }
    // A method a read calls, as `args.items.map(…)`, is not part of the arg's value.
    const called =
      parent?.type === 'CallExpression' && parent.callee === node && base.path.length > 0;
    const target = called ? (node as E.MemberExpression).object : node;
    const path = called ? base.path.slice(0, -1) : base.path;
    reads.push({
      kind: 'arg',
      node: target,
      read: { arg: base.arg, ...(path.length > 0 && { path }) },
      place: called ? { kind: 'code' } : placeOf(node, parents, bindings, source),
    });
    return false;
  });
  return reads;
}

// The args a destructured parameter binds, each by its local name, at `path` in the args.
function destructuredArgs(pattern: E.ObjectPattern, path: string[]): Map<string, ArgRead> {
  const names = new Map<string, ArgRead>();
  for (const property of pattern.properties) {
    const key = property.type === 'Property' ? keyName(property) : undefined;
    if (property.type !== 'Property' || key === undefined) {
      continue;
    }
    const [arg = key, ...rest] = [...path, key];
    const read = { arg, ...(rest.length > 0 && { path: rest }) };
    if (property.value.type === 'Identifier') {
      names.set(property.value.name, read);
    } else if (property.value.type === 'ObjectPattern') {
      destructuredArgs(property.value, [...path, key]).forEach((value, name) =>
        names.set(name, value)
      );
    }
  }
  return names;
}

// An identifier, or a chain of static member reads on one, as `args.user.name`.
function memberChain(
  node: Node
): { root: Extract<Node, { type: 'Identifier' }>; keys: string[] } | undefined {
  if (node.type === 'Identifier') {
    return { root: node, keys: [] };
  }
  if (node.type !== 'MemberExpression') {
    return undefined;
  }
  const key = node.computed
    ? isStringLiteral(node.property)
      ? node.property.value
      : undefined
    : node.property.type === 'Identifier'
      ? node.property.name
      : undefined;
  const object = memberChain(node.object);
  return key === undefined || !object ? undefined : { ...object, keys: [...object.keys, key] };
}

// A member or key name, which reads no arg.
const isName = (node: Node, parent: Node | null) =>
  (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) ||
  (parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand);

const keyName = (
  property: Extract<E.ObjectPattern['properties'][number], { type: 'Property' }>
): string | undefined =>
  property.computed
    ? undefined
    : property.key.type === 'Identifier'
      ? property.key.name
      : isStringLiteral(property.key)
        ? property.key.value
        : undefined;

const WRAPPERS = new Set(['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression']);

// Where a read stands: an expression of a template literal, with only type wrappers around it, is
// text, or the value of an attribute, in the html of the template before it.
function placeOf(
  node: Node,
  parents: Map<Node, Node | null>,
  bindings: Map<string, ImportBinding>,
  source: { code: string; start: number }
) {
  let expression = node;
  let parent = parents.get(node) ?? null;
  while (parent && WRAPPERS.has(parent.type)) {
    expression = parent;
    parent = parents.get(parent) ?? null;
  }
  if (parent?.type !== 'TemplateLiteral') {
    return { kind: 'code' } as const;
  }
  const index = parent.expressions.indexOf(expression as E.Expression);
  const tag = parents.get(parent);
  const lit = tag?.type === 'TaggedTemplateExpression' && isLitHtml(tag.tag, bindings);
  // The `${…}` around the expression.
  const span = {
    start: source.code.lastIndexOf('${', expression.start - source.start) + source.start,
    end: source.code.indexOf('}', expression.end - source.start) + 1 + source.start,
  };
  if (tag?.type === 'TaggedTemplateExpression' && !lit) {
    return { kind: 'code' } as const;
  }
  if (!lit) {
    return { kind: 'html', span } as const;
  }
  const before = parent.quasis
    .slice(0, index + 1)
    .map((quasi) => quasi.value.raw)
    .join('\0');
  const after = parent.quasis[index + 1]!.value.raw;
  const context = htmlContext(before);
  if (context === 'text') {
    return { kind: 'text', span } as const;
  }
  if (context === 'quoted') {
    const name = /([^\s"'=]+)=["'][^"']*$/.exec(before)?.[1] ?? '';
    return /^[.?@]/.test(name) ? ({ kind: 'code' } as const) : ({ kind: 'quoted', span } as const);
  }
  const name = /\s([^\s"'>/=.?@][^\s"'>/=]*)=$/.exec(before)?.[1];
  return context === 'tag' && name !== undefined && /^(\s|\/?>|$)/.test(after)
    ? ({ kind: 'attr', name, span } as const)
    : ({ kind: 'code' } as const);
}

// Whether the html before a lit expression leaves it in text, in a start tag, in a quoted attribute
// value, or in a comment or a raw text element, where it stays code.
function htmlContext(html: string): 'text' | 'tag' | 'quoted' | 'raw' {
  let state: 'text' | 'tag' | 'quoted' | 'raw' = 'text';
  let quote = '';
  let raw = '';
  for (let index = 0; index < html.length; index++) {
    const character = html[index]!;
    if (state === 'raw') {
      if (html.startsWith(raw, index)) {
        state = 'text';
        index += raw.length - 1;
      }
    } else if (state === 'text') {
      if (html.startsWith('<!--', index)) {
        state = 'raw';
        raw = '-->';
      } else if (character === '<' && /[a-zA-Z/]/.test(html[index + 1] ?? '')) {
        state = 'tag';
        const element = /^<(script|style|textarea|title)\b/i.exec(html.slice(index))?.[1];
        raw = element ? `</${element.toLowerCase()}` : '';
      }
    } else if (state === 'tag') {
      if (character === '"' || character === "'") {
        state = 'quoted';
        quote = character;
      } else if (character === '>') {
        state = raw ? 'raw' : 'text';
      }
    } else if (character === quote) {
      state = 'tag';
    }
  }
  return state;
}

const isLitHtml = (tag: Node, bindings: Map<string, ImportBinding>) => {
  const binding = tag.type === 'Identifier' ? bindings.get(tag.name) : undefined;
  return (
    !!binding &&
    ['lit', 'lit-html', 'lit-element'].includes(binding.importId) &&
    ['html', 'default'].includes(binding.importName)
  );
};

// The code a read is replaced with: the arg's value where the story sets it, as the text its place
// prints or as code, in a hole for the arg.
function edit(read: Read, args: Record<string, Node>): Span & { text: string; hole?: HtmlHole } {
  if (read.kind === 'whole') {
    const entries = Object.entries(args).map(([name, node]) => {
      const key = /^[A-Za-z_$][\w$]*$/.test(name) ? name : printValue(name, name, { quote: "'" });
      return `${key}: ${detachedTextOf(node)}`;
    });
    return { start: read.node.start, end: read.node.end, text: `{ ${entries.join(', ')} }` };
  }
  const { arg, path = [] } = read.read;
  const node = args[arg];
  const evaluated = node ? evaluateArgValue(node) : ({ kind: 'unset' } as const);
  const known = evaluated.kind === 'value' || evaluated.kind === 'unset';
  const value =
    evaluated.kind === 'value'
      ? path.reduce<unknown>(
          (current, key) =>
            current === null || current === undefined
              ? undefined
              : (current as Record<string, unknown>)[key],
          evaluated.value
        )
      : undefined;
  const { place } = read;
  // A value lit or JavaScript prints as text, in the place it stands.
  const text = known && (value === null || typeof value !== 'object' || Array.isArray(value));
  if (place.kind !== 'code' && text) {
    const printed =
      place.kind === 'attr'
        ? quotedAttribute(place.name, boundText(value))
        : place.kind === 'quoted'
          ? escapeAttribute(boundText(value))
          : place.kind === 'text'
            ? escapeText(childText(value).replace(/\s+/g, ' '))
            : String(value);
    // `name=${…}` is the attribute as a whole.
    const span =
      place.kind === 'attr'
        ? { start: place.span.start - place.name.length - 1, end: place.span.end }
        : place.span;
    const hole: HtmlHole =
      place.kind === 'attr'
        ? attrHole(read.read, place.name, 'bind')
        : { kind: place.kind, ...read.read };
    return { ...span, text: templateText(printed), hole };
  }
  const source =
    !node || evaluated.kind === 'unset'
      ? 'undefined'
      : path.length === 0
        ? detachedTextOf(node)
        : known
          ? printValue(value, arg, { quote: "'" })
          : `${detachedTextOf(node)}${path.map((key) => `.${key}`).join('')}`;
  return {
    start: read.node.start,
    end: read.node.end,
    text: source,
    hole: { kind: 'code', ...read.read },
  };
}
