import {
  type ESTree as E,
  type ESTreeNode as Node,
  SourceEditor,
  staticKey,
  textOf,
  unwrapExpression,
  walk as walkEstree,
} from 'storybook/internal/csf-tools';
import {
  type HoleMarks,
  type SnippetTemplate,
  createHoleMarks,
  withHoleSpace,
} from 'storybook/internal/docs-tools';
import { walk } from 'zimmerframe';

import {
  type PropValue,
  type SvelteHolePlace,
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
  mark: Mark;
}

type Mark = HoleMarks<SvelteHolePlace>['mark'];

// An edit the static snippet makes, `value`, which is the code as written where it keeps it, and
// `marked`, the same code with the places an arg prints in it marked as holes for the template.
type MarkedEdit = Edit & { marked?: string };

// Write a story's args into its markup: spread `{...args}` into attributes, and replace each
// `args.x` read with the source of the arg value. The template is the same markup with each place
// an arg prints as a hole that holds what it prints there, or `undefined` when its holes cannot be
// found again.
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
}): { snippet: string; template?: SnippetTemplate<SvelteHolePlace> } {
  const { ast, offset } = parseMarkup(code, typescript);
  // The edits that print the snippet, with each place an arg prints marked by `mark`.
  const collect = (mark: Mark): MarkedEdit[] => {
    const destructured = new Set(Object.values(parameter?.aliases ?? {}));
    const name = parameter ? parameter.name : 'args';
    const reads: Reads = {
      args,
      name,
      aliases: parameter?.aliases ?? {},
      typescript,
      argsComplete,
      mark,
    };
    const isArgsSpread = (attribute: SvelteAST.Component['attributes'][number]) =>
      attribute.type === 'SpreadAttribute' &&
      attribute.expression.type === 'Identifier' &&
      attribute.expression.name === name;
    const at = (node: object): Span => {
      const range = span(node);
      return { start: range.start - offset, end: range.end - offset };
    };
    const written = ({ start, end }: Span) => code.slice(start, end);
    const edits: MarkedEdit[] = [];

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
        if (spreadAfter && (node.name in args || readsNoArgs)) {
          const range = at(node);
          const value =
            node.name in args
              ? printSpreadAttribute(node.name, propValue(args[node.name]))
              : written(range);
          edits.push({
            ...range,
            value,
            marked: mark({ place: { kind: 'spreadattr' }, arg: node.name }, value),
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
        const writtenProps = new Set([
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
        const passed = (key: string) => !writtenProps.has(key) && !destructured.has(key);
        const props = Object.entries(args).flatMap(([key, value]): [string, string][] => {
          const printed = propValue(value);
          return key in snippets || !passed(key) || printed === undefined
            ? []
            : [[key, printProp(key, printed)]];
        });
        const spread = spreadPlace(code, at(node), mark, props, [
          ...props.map(([key]) => key),
          ...writtenProps,
          ...destructured,
          ...Object.keys(snippets),
        ]);
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
        const replaced = replaceArgsReads(written(range), reads);
        if (replaced === undefined) return;
        const parent = path.at(-1);
        const tag = at(node);
        const text = replaced.text;
        const attribute = parent?.type === 'Attribute' ? at(parent) : undefined;
        const quoted = attribute && /=\s*["']/.test(code.slice(attribute.start, range.start));
        // `title={args.title}` and `{title}` print a string as a spread prints it: `title="Save"`.
        const asAttribute =
          parent?.type === 'Attribute' && parent.value === node
            ? attributeText(parent.name, text)
            : undefined;
        const asQuoted = quoted ? quotedText(text) : undefined;
        const asFragment = parent?.type === 'Fragment' ? fragmentText(text) : undefined;
        // `{label}` names the attribute after the variable it reads.
        const shorthand = parent?.type === 'Attribute' && code[attribute!.start] === '{';
        let edit: Edit = { ...range, value: replaced.value };
        if (asAttribute !== undefined) {
          edit = { ...attribute!, value: asAttribute };
        } else if (shorthand) {
          edit = { ...attribute!, value: `${parent.name}={${replaced.value}}` };
        } else if (asQuoted !== undefined || asFragment !== undefined) {
          edit = { ...tag, value: (asQuoted ?? asFragment)! };
        }
        if (!replaced.changed) {
          edit = { ...range, value: written(range) };
        }
        if (!replaced.single) {
          edits.push({ ...edit, marked: replaced.marked });
          return;
        }
        // One whole read prints as text or code by its value, so its hole holds the whole place.
        const { arg, deep } = replaced.single;
        const attributeName =
          parent?.type === 'Attribute' && parent.value === node ? parent.name : undefined;
        const place = attributeName === undefined ? tag : attribute!;
        const [before, after] =
          attributeName !== undefined && shorthand
            ? [`${attributeName}={`, '}']
            : [code.slice(place.start, range.start), code.slice(range.end, place.end)];
        const holePlace: SvelteHolePlace = deep
          ? { kind: 'member' }
          : attributeName !== undefined
            ? { kind: 'attrvalue', name: attributeName, before, after }
            : {
                kind: quoted ? 'quoted' : parent?.type === 'Fragment' ? 'fragment' : 'code',
                before,
                after,
              };
        const value =
          code.slice(place.start, edit.start) + edit.value + code.slice(edit.end, place.end);
        edits.push({
          ...place,
          value,
          marked: mark({ place: holePlace, arg }, value),
        });
      },
      _(node, { next }) {
        if (node.type === 'ExpressionTag') return next();
        for (const expression of blockExpressions(node)) {
          const range = at(expression);
          const replaced = replaceArgsReads(written(range), reads);
          if (replaced === undefined) continue;
          // `class:active` reads `active`, so a substituted value needs the long form, which the
          // snippet writes once it substitutes one.
          const shorthand =
            'name' in node &&
            node.type.endsWith('Directive') &&
            !code.slice(at(node).start, range.start).includes('=');
          if (!shorthand) {
            edits.push({ ...range, value: replaced.value, marked: replaced.marked });
            continue;
          }
          const value = replaced.changed ? `${node.name}={${replaced.value}}` : written(range);
          edits.push({
            ...range,
            value,
            marked: replaced.single
              ? mark(
                  {
                    place: { kind: 'code', before: `${node.name}={`, after: '}' },
                    arg: replaced.single.arg,
                  },
                  value
                )
              : value,
          });
        }
        next();
      },
    });

    return edits;
  };

  const snippet = applyEdits(
    code,
    collect((_, text) => text)
  );
  // The marked print is the snippet with marks in it, including arg values a string literal writes
  // escaped, so marks none of the snippet's characters are never read in it.
  const marks = createHoleMarks<SvelteHolePlace>([snippet]);
  const marked = collect(marks.mark).map((edit) => ({ ...edit, value: edit.marked ?? edit.value }));
  const template = marks.toTemplate(applyEdits(code, marked));
  return {
    snippet,
    // An arg a control clears leaves no gap in the spread.
    ...(template && { template: withHoleSpace(template, (place) => place.kind === 'prop') }),
  };
}

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

// The edit of a `{...args}` spread, which prints the props one a line when they are long. It
// replaces the whitespace before the spread too: the spread's line when it prints no props and is
// alone on it, else the spaces before it. In the template each prop is a hole, followed by one for
// the args a control sets, except the `printed` names.
function spreadPlace(
  code: string,
  span: Span,
  mark: Mark,
  props: [string, string][],
  printed: string[]
): MarkedEdit {
  const values = props.map(([, prop]) => prop);
  const onePerLine = values.join(' ').length > 50;
  const separator = onePerLine ? '\n  ' : ' ';
  const holes = props.map(([arg, prop]) => mark({ place: { kind: 'prop' }, arg }, prop));
  const added = (space: string) =>
    mark({ place: { kind: 'props', except: printed }, spread: true }, '', space);
  const { end } = span;
  let { start } = span;
  if (onePerLine) while (start > 0 && /[ \t]/.test(code[start - 1])) start--;
  if (props.length) {
    const [value, marked] = [values, holes].map((pieces) => pieces.join(separator));
    return onePerLine
      ? {
          start,
          end,
          value: `\n  ${value}\n`,
          marked: `\n  ${marked}${added(separator)}\n`,
        }
      : { start, end, value, marked: `${marked}${added(separator)}` };
  }
  const lineStart = code.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = code.indexOf('\n', end);
  if (lineEnd !== -1 && !code.slice(lineStart, start).trim() && !code.slice(end, lineEnd).trim()) {
    // The line goes, so the args a control adds go on a line of their own.
    return {
      start: lineStart - 1,
      end: lineEnd,
      value: '',
      marked: added(`\n${code.slice(lineStart, start)}`),
    };
  }
  if (code[start - 1] === ' ') start--;
  return { start, end, value: '', marked: added(' ') };
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
// return `undefined` when the expression reads no story args. Next keeps a read of an arg the story
// does not set as written, unless `argsComplete`; `changed` says whether it replaced any. `marked`
// has a hole for each read of an arg, and `single` is the arg when the expression is one whole read
// of it, `deep` when it reads a member of it. `text` is set when that read is of a string.
function replaceArgsReads(
  expression: string,
  { args, name, aliases, typescript, argsComplete, mark }: Reads
):
  | {
      value: string;
      marked: string;
      changed: boolean;
      text?: string;
      single?: { arg: string; deep: boolean };
    }
  | undefined {
  // The parentheses let an object literal or a sequence parse as one expression.
  const editor = new SourceEditor(`(${expression})`, scriptFile(typescript));
  const edits: (Edit & { node?: Node; marked: string; arg: string; place: SvelteHolePlace })[] = [];
  // A read of `arg` from `start` to `end`, which the snippet prints as `read`, or keeps as written.
  const push = (
    arg: string,
    start: number,
    end: number,
    read: { value: string; node?: Node } | undefined,
    { deep = false, property }: { deep?: boolean; property?: string } = {}
  ) => {
    const value =
      read === undefined
        ? expression.slice(start, end)
        : property === undefined
          ? read.value
          : `${property}: ${read.value}`;
    const place: SvelteHolePlace = deep
      ? { kind: 'member' }
      : property === undefined
        ? { kind: 'value' }
        : { kind: 'property', name: property };
    edits.push({
      start,
      end,
      value,
      node: property === undefined ? read?.node : undefined,
      marked: mark({ place, arg }, value),
      arg,
      place,
    });
  };
  // The value of an arg that the template parameter destructures.
  const valueOf = (key: string): { value: string; node?: Node } | undefined => {
    if (key in args) return printMemberRead(args[key], []);
    return argsComplete ? { value: 'undefined' } : undefined;
  };
  const aliasOf = (node: Node) =>
    node.type === 'Identifier' && !editor.scopes.bindingOf(node) ? aliases[node.name] : undefined;
  walkEstree(editor.program, (node, parent) => {
    if (node.type === 'MemberExpression') {
      const keys = name === undefined ? undefined : argsPath(node, editor, name);
      if (!keys?.length) return;
      const [key, ...members] = keys;
      const read =
        key in args
          ? printMemberRead(args[key], members)
          : argsComplete
            ? { value: 'undefined' }
            : undefined;
      push(key, node.start - 1, node.end - 1, read, { deep: members.length > 0 });
      return false;
    }
    if (node.type === 'Property' && node.shorthand && node.value.type === 'Identifier') {
      const key = aliasOf(node.value);
      if (key === undefined) return;
      push(key, node.start - 1, node.end - 1, valueOf(key), { property: node.value.name });
      return false;
    }
    if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (parent?.type === 'Property' && parent.key === node && !parent.computed) return;
    const key = aliasOf(node);
    if (key === undefined) return;
    push(key, node.start - 1, node.end - 1, valueOf(key));
  });
  if (!edits.length) return undefined;
  const [only] = edits;
  const whole =
    edits.length === 1 &&
    expression.slice(0, only.start).trim() === '' &&
    expression.slice(only.end).trim() === '';
  const text =
    whole && only.node?.type === 'Literal' && typeof only.node.value === 'string'
      ? readText(only.node.value)
      : undefined;
  const value = applyEdits(expression, edits);
  return {
    value,
    marked: applyEdits(
      expression,
      edits.map((edit) => ({ ...edit, value: edit.marked }))
    ),
    changed: value !== expression,
    ...(text !== undefined ? { text } : {}),
    ...(whole && only.place.kind !== 'property'
      ? { single: { arg: only.arg, deep: only.place.kind === 'member' } }
      : {}),
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
