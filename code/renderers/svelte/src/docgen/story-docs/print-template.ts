import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  staticKey,
  textOf,
  unwrapExpression,
  walk as walkEstree,
} from 'storybook/internal/csf-tools';
import { defaultWord, hole, holeWord, withHoleSpace } from 'storybook/internal/docs-tools';
import { walk } from 'zimmerframe';

import {
  type PropValue,
  attributeText,
  fragmentText,
  isPrimary,
  printProp,
  printRead,
  printSpreadAttribute,
  quotedText,
  readText,
} from '../../snippet-values.ts';
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
  holes: boolean;
}

// A hole for a whole arg read, before the words of the place it is printed in: the arg, whether its
// written code needs parentheses (`p`), whether the story quotes it with `'`, and the code it
// prints while the arg is unset, where next leaves the read as written.
interface ReadHole {
  arg: string;
  words: string[];
  // The code next leaves for an unset arg; the default of a hole that replaces more than the read.
  unset?: string;
}

// Write a story's args into its markup: spread `{...args}` into attributes, and replace each
// `args.x` read with the source of the arg value. With `holes`, every place that prints an arg's
// value prints a hole instead, which `fillTemplate` in `../../docs/fill-template.ts` fills with the
// current args as this prints them; every other decision is the same, so the template filled with
// the story's own args is the snippet.
export function printTemplate({
  code,
  args,
  typescript,
  parameter,
  snippets = {},
  argsComplete = false,
  holes = false,
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
  holes?: boolean;
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
    holes,
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
      const spreadAfter =
        element &&
        'attributes' in element &&
        element.attributes.some(
          (attribute: SvelteAST.Component['attributes'][number]) =>
            isArgsSpread(attribute) && attribute.start > node.start
        );
      // The spread writes over it with the arg, or leaves it as written while the arg is unset.
      const readsNoArgs =
        node.value === true ||
        (Array.isArray(node.value) && node.value.every((part) => part.type === 'Text'));
      if (spreadAfter && holes && (node.name in args || readsNoArgs)) {
        const range = at(node);
        edits.push({
          ...range,
          value: hole(
            'spreadattr',
            holeWord(node.name),
            ...quoteWords(args[node.name]),
            defaultWord(code.slice(range.start, range.end))
          ),
        });
        return;
      }
      if (spreadAfter && node.name in args) {
        edits.push({
          ...at(node),
          value: printSpreadAttribute(node.name, propValue(args[node.name])),
        });
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
        key in snippets || !passed(key) ? [] : printPropOf(key, value)
      );
      const spread = spreadEdit(code, at(node), props);
      edits.push(
        holes
          ? spreadHole(
              code,
              at(node),
              [...written, ...destructured, ...Object.keys(snippets)],
              Object.entries(args).flatMap(([key, value]) =>
                quoteWords(value).length ? [`'${encodeURIComponent(key)}`] : []
              ),
              spread.value.startsWith('\n')
            )
          : spread
      );
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
      if (replaced.single) {
        edits.push(readPlaceHole(code, replaced.single, node, at(node), range, parent, at));
        return;
      }
      const text = replaced.text;
      const quoted =
        parent?.type === 'Attribute' && /=\s*["']/.test(code.slice(at(parent).start, range.start));
      // `title={args.title}` and `{title}` print a string as a spread prints it: `title="Save"`.
      const asAttribute =
        parent?.type === 'Attribute' && parent.value === node
          ? attributeText(parent.name, text)
          : undefined;
      const asQuoted = quoted ? quotedText(text) : undefined;
      const asFragment = parent?.type === 'Fragment' ? fragmentText(text) : undefined;
      if (asAttribute !== undefined) {
        edits.push({ ...at(parent!), value: asAttribute });
      } else if (parent?.type === 'Attribute' && code[at(parent).start] === '{') {
        // `{label}` names the attribute after the variable it reads.
        edits.push({ ...at(parent), value: `${parent.name}={${replaced.value}}` });
      } else if (asQuoted !== undefined) {
        edits.push({ ...at(node), value: asQuoted });
      } else if (asFragment !== undefined) {
        edits.push({ ...at(node), value: asFragment });
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
        // Next keeps a shorthand it substitutes nothing in, as for an unset arg, and writes the long
        // form once a control sets it.
        if (
          shorthand &&
          holes &&
          replaceArgsReads(code.slice(range.start, range.end), { ...reads, holes: false }) ===
            undefined
        ) {
          if (replaced.single) {
            edits.push({
              ...range,
              value: hole(
                'code',
                ...replaced.single.words,
                `<${encodeURIComponent(`${node.name}={`)}`,
                `>${encodeURIComponent('}')}`,
                defaultWord(code.slice(range.start, range.end))
              ),
            });
          }
          continue;
        }
        edits.push({
          ...range,
          value: shorthand ? `${node.name}={${replaced.value}}` : replaced.value,
        });
      }
      next();
    },
  });

  const printed = applyEdits(code, edits);
  return holes ? withHoleSpace(printed, takesSpace) : printed;
}

// A hole that prints nothing leaves no empty line. A spread hole holds the space around it.
const takesSpace = (kind: string, space: string) => kind !== 'spread' && space.includes('\n');

// An arg as a spread prints it, from the code the story writes it with.
function propValue(value: Node): PropValue {
  const node = unwrapExpression(value);
  if (node.type === 'Identifier' && node.name === 'undefined') return undefined;
  if (node.type === 'Literal' && node.value === true) return true;
  return {
    ...(node.type === 'Literal' && typeof node.value === 'string' ? { string: node.value } : {}),
    code: textOf(value),
  };
}

function printPropOf(key: string, value: Node): string[] {
  const printed = propValue(value);
  return printed === undefined ? [] : [printProp(key, printed)];
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
// exactly one read of a string. With `holes`, a read of a whole arg is a hole, also for an arg the
// story does not set, and `single` is set when the expression is exactly one such read.
function replaceArgsReads(
  expression: string,
  { args, name, aliases, typescript, argsComplete, holes }: Reads
): { value: string; text?: string; single?: ReadHole } | undefined {
  // The parentheses let an object literal or a sequence parse as one expression.
  const editor = new SourceEditor(`(${expression})`, scriptFile(typescript));
  const edits: (Edit & { node?: Node; hole?: ReadHole; property?: boolean })[] = [];
  const holeEdit = (key: string, start: number, end: number, before = '') => {
    const read: ReadHole = {
      arg: key,
      words: readWords(key, args[key]),
      ...(key in args || argsComplete ? {} : { unset: expression.slice(start, end) }),
    };
    return {
      start,
      end,
      value: hole(
        'value',
        ...read.words,
        ...(before ? [`<${encodeURIComponent(before)}`] : []),
        ...(read.unset === undefined ? [] : [defaultWord(read.unset)])
      ),
      hole: read,
      property: before !== '',
    };
  };
  // The value of an arg that the template parameter destructures.
  const valueOf = (node: Node): { value: string; node?: Node } | undefined => {
    if (node.type !== 'Identifier' || editor.scopes.bindingOf(node)) return undefined;
    const key = aliases[node.name];
    if (key === undefined) return undefined;
    if (key in args) return printMemberRead(args[key], []);
    return argsComplete ? { value: 'undefined' } : undefined;
  };
  const aliasOf = (node: Node) =>
    node.type === 'Identifier' && !editor.scopes.bindingOf(node) ? aliases[node.name] : undefined;
  walkEstree(editor.program, (node, parent) => {
    if (node.type === 'MemberExpression') {
      const keys = name === undefined ? undefined : argsPath(node, editor, name);
      if (!keys?.length) return;
      if (holes && keys.length === 1) {
        edits.push(holeEdit(keys[0], node.start - 1, node.end - 1));
        return false;
      }
      if (!(keys[0] in args)) {
        if (!argsComplete) return;
        edits.push({ start: node.start - 1, end: node.end - 1, value: 'undefined' });
        return false;
      }
      edits.push({
        start: node.start - 1,
        end: node.end - 1,
        ...printMemberRead(args[keys[0]], keys.slice(1)),
      });
      return false;
    }
    if (node.type === 'Property' && node.shorthand && node.value.type === 'Identifier') {
      const key = holes ? aliasOf(node.value) : undefined;
      if (key !== undefined) {
        edits.push(holeEdit(key, node.start - 1, node.end - 1, `${node.value.name}: `));
        return false;
      }
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
    const key = holes ? aliasOf(node) : undefined;
    if (key !== undefined) {
      edits.push(holeEdit(key, node.start - 1, node.end - 1));
      return;
    }
    const read = valueOf(node);
    if (!read) return;
    edits.push({ start: node.start - 1, end: node.end - 1, ...read });
  });
  if (!edits.length) return undefined;
  const [only] = edits;
  const whole =
    edits.length === 1 &&
    expression.slice(0, only.start).trim() === '' &&
    expression.slice(only.end).trim() === '';
  if (whole && only.hole && !only.property) {
    return { value: only.value, single: only.hole };
  }
  const text =
    whole && only.node?.type === 'Literal' && typeof only.node.value === 'string'
      ? readText(only.node.value)
      : undefined;
  return { value: applyEdits(expression, edits), ...(text !== undefined ? { text } : {}) };
}

// The words of a hole for a read of `key`: the arg, `p` when the code the story writes it with
// needs parentheses where a read stood, and `'` when the story quotes it so.
function readWords(key: string, value: Node | undefined): string[] {
  const node = value && unwrapExpression(value);
  return [holeWord(key), ...(node && !isPrimaryNode(node) ? ['p'] : []), ...quoteWords(value)];
}

// `'` for a string the story writes in single quotes, which next prints as written.
function quoteWords(value: Node | undefined): string[] {
  const node = value && unwrapExpression(value);
  return node?.type === 'Literal' && typeof node.value === 'string' && textOf(node).startsWith("'")
    ? ["'"]
    : [];
}

// A hole for an `{expression}` that is one whole arg read, in the place it prints in: as next does,
// an attribute value or text prints a plain string as text, and anything else as code.
function readPlaceHole(
  code: string,
  read: ReadHole,
  tag: object,
  tagSpan: Span,
  range: Span,
  parent: SvelteAST.SvelteNode | undefined,
  at: (node: object) => Span
): Edit {
  const words = (kind: string, span: Span, pre: string, post: string, more: string[] = []) => ({
    ...span,
    value: hole(
      kind,
      ...read.words,
      ...more,
      `<${encodeURIComponent(pre)}`,
      `>${encodeURIComponent(post)}`,
      ...(read.unset === undefined ? [] : [defaultWord(code.slice(span.start, span.end))])
    ),
  });
  if (parent?.type === 'Attribute' && parent.value === tag) {
    const attribute = at(parent);
    // `{label}` names the attribute after the variable it reads.
    const shorthand = code[attribute.start] === '{';
    return words(
      'attrvalue',
      attribute,
      shorthand ? `${parent.name}={` : code.slice(attribute.start, range.start),
      shorthand ? '}' : code.slice(range.end, attribute.end),
      [`=${encodeURIComponent(parent.name)}`]
    );
  }
  const pre = code.slice(tagSpan.start, range.start);
  const post = code.slice(range.end, tagSpan.end);
  if (parent?.type === 'Attribute' && /=\s*["']/.test(code.slice(at(parent).start, range.start))) {
    return words('quoted', tagSpan, pre, post);
  }
  if (parent?.type === 'Fragment') {
    return words('fragment', tagSpan, pre, post);
  }
  return words('code', tagSpan, pre, post);
}

// The hole for a `{...args}` spread, which spans the whitespace next takes along with it: the
// spread's line when it is alone on it, else the spaces before it. Its words name the args the
// element writes itself (`-`) and the args the story quotes with `'`, and lay the spread out as
// next lays out the story's own args: the code before (`<`) and after (`>`) the props, the
// separator between them (`|`), and the code that stands for a spread that passes none (`?`).
function spreadHole(
  code: string,
  span: Span,
  written: string[],
  quoted: string[],
  onePerLine: boolean
): Edit {
  const lineStart = code.lastIndexOf('\n', span.start - 1) + 1;
  const lineEnd = code.indexOf('\n', span.end);
  const alone =
    lineEnd !== -1 &&
    !code.slice(lineStart, span.start).trim() &&
    !code.slice(span.end, lineEnd).trim();
  let trimmed = span.start;
  while (trimmed > 0 && /[ \t]/.test(code[trimmed - 1])) trimmed--;
  const start = alone ? lineStart : trimmed;
  const end = alone ? lineEnd + 1 : span.end;
  // Where next removes a spread that passes nothing: its line, or the space before it.
  const emptyStart = alone ? lineStart : code[span.start - 1] === ' ' ? span.start - 1 : span.start;
  const before = code.slice(start, onePerLine ? trimmed : span.start);
  const after = code.slice(span.end, end);
  const word = (prefix: string, text: string) => `${prefix}${encodeURIComponent(text)}`;
  return {
    start,
    end,
    value: hole(
      'spread',
      ...[...new Set(written)].map((key) => word('-', key)),
      ...quoted,
      word('<', onePerLine ? `${before}\n  ` : before),
      word('|', onePerLine ? '\n  ' : ' '),
      word('>', onePerLine ? `\n${after}` : after),
      defaultWord(code.slice(start, emptyStart) + code.slice(alone ? lineEnd + 1 : span.end, end))
    ),
  };
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
function printMemberRead(value: Node, keys: string[]): { value: string; node?: Node } {
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
    value: printRead(textOf(node), !isPrimaryNode(node)) + accessors,
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

// Whether an arg's code keeps its meaning where an `args.x` read stood, as `isPrimary` decides.
function isPrimaryNode(node: Node): boolean {
  return isPrimary(
    node.type,
    node.type === 'Literal' && typeof node.value === 'number' && node.value < 0
  );
}
