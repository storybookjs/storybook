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
  type WholeRead,
  type WholeReadPlace,
  printAccessors,
  printProp,
  printSpreadAttribute,
  printWholeRead,
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

// An edit of the snippet, with `marked`: its `value` with each place an arg prints marked as a hole,
// and the `read` of an arg it prints, where it is one whole read.
type MarkedEdit = Edit & { marked?: string; read?: WholeRead };

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
    // The walker's `attributes` arrays hold both Svelte attribute kinds and estree import
    // attributes, so the guard starts from the wide node union and narrows to one kind.
    const isArgsSpread = (
      attribute: SvelteAST.SvelteNode | E.ImportAttribute
    ): attribute is SvelteAST.SpreadAttribute =>
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
            (attribute) => isArgsSpread(attribute) && attribute.start > node.start
          );
        const range = at(node);
        // The spread writes over it with the arg.
        if (spreadAfter && node.name in args) {
          const value = printSpreadAttribute(node.name, propValue(args[node.name]));
          edits.push({
            ...range,
            value,
            marked: mark({ kind: 'spreadattr', arg: node.name }, value),
          });
          return;
        }
        // A spread of the rest leaves out the args the template parameter destructures.
        if (!spreadAfter || destructured.has(node.name)) {
          next();
          return;
        }
        const readArgs = (Array.isArray(node.value) ? node.value : [node.value]).flatMap((part) =>
          part !== true && part.type === 'ExpressionTag'
            ? (replaceArgsReads(written(at(part.expression)), reads)?.args ?? [])
            : []
        );
        const from = edits.length;
        next();
        const own = readArgs.every((arg) => arg === node.name);
        const [read, ...more] = edits.slice(from).map((edit) => edit.read);
        if (!own && (read?.kind !== 'attrvalue' || more.length)) {
          // Its reads follow their args, but it cannot also follow the arg it names.
          edits.push({
            start: range.end,
            end: range.end,
            value: '',
            marked: mark({ kind: 'overwritten', arg: node.name }, ''),
          });
          return;
        }
        // It prints as written until the spread writes over it, or, as `name={args.x}`, the arg it
        // reads changes.
        const value = applyEdits(
          written(range),
          edits.splice(from).map((edit) => ({
            ...edit,
            start: edit.start - range.start,
            end: edit.end - range.start,
          }))
        );
        edits.push({
          ...range,
          value,
          marked: mark(
            own
              ? { kind: 'spreadattr', arg: node.name }
              : // `printTemplate` sets `written` to the hole's text.
                { kind: 'overridden', spread: true, name: node.name, read: read!, written: '' },
            value
          ),
        });
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
            ? element.attributes.flatMap((attribute) =>
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
        if (!replaced.single) {
          edits.push({ ...range, value: replaced.value, marked: replaced.marked });
          return;
        }
        // One whole read prints as text or code by its value, so its hole holds the whole place.
        const { arg, path: members, string } = replaced.single;
        const parent = path.at(-1);
        const attribute = parent?.type === 'Attribute' ? parent : undefined;
        const place = attribute?.value === node ? at(attribute) : at(node);
        const before = code.slice(place.start, range.start);
        const after = code.slice(range.end, place.end);
        let wholeRead: WholeReadPlace;
        if (attribute?.value === node) {
          // `{label}` names the attribute after the variable it reads.
          const shorthand = code[place.start] === '{';
          wholeRead = {
            kind: 'attrvalue',
            ...(attribute.name !== arg && { name: attribute.name }),
            before: shorthand ? `${attribute.name}={` : before,
            after: shorthand ? '}' : after,
            ...(members && { path: members }),
          };
        } else {
          const quoted =
            attribute !== undefined &&
            /=\s*["']/.test(code.slice(at(attribute).start, range.start));
          const kind = quoted ? 'quoted' : parent?.type === 'Fragment' ? 'fragment' : 'code';
          wholeRead = { kind, before, after, ...(members && { path: members }) };
        }
        const value = replaced.substituted
          ? printWholeRead(wholeRead, arg, replaced.value, string)
          : written(place);
        edits.push({
          ...place,
          value,
          marked: mark({ ...wholeRead, arg }, value),
          read: { ...wholeRead, arg },
        });
      },
      _(node, { next }) {
        if (node.type === 'ExpressionTag') return next();
        for (const expression of blockExpressions(node)) {
          const range = at(expression);
          const replaced = replaceArgsReads(written(range), reads);
          if (replaced === undefined) continue;
          // `class:active` reads `active`, so a substituted value needs the long form.
          const shorthand =
            'name' in node &&
            node.type.endsWith('Directive') &&
            !code.slice(at(node).start, range.start).includes('=');
          if (!shorthand) {
            edits.push({ ...range, value: replaced.value, marked: replaced.marked });
            continue;
          }
          const value = replaced.substituted ? `${node.name}={${replaced.value}}` : written(range);
          edits.push({
            ...range,
            value,
            marked: replaced.single
              ? mark(
                  { kind: 'code', before: `${node.name}={`, after: '}', arg: replaced.single.arg },
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
  // The marks avoid the characters of the snippet, not of `code`: `'\uE000'` prints U+E000.
  const marks = createHoleMarks<SvelteHolePlace>([snippet]);
  const marked = collect(marks.mark).map((edit) => ({ ...edit, value: edit.marked ?? edit.value }));
  const template: SnippetTemplate<SvelteHolePlace> | undefined = marks
    .toTemplate(applyEdits(code, marked))
    ?.map((segment) =>
      // While no arg it follows changes, an `overridden` hole prints the attribute as written.
      typeof segment !== 'string' && segment.kind === 'overridden'
        ? { ...segment, written: segment.text }
        : segment
    );
  return {
    snippet,
    // An arg a control clears leaves no gap in the spread.
    ...(template && { template: withHoleSpace(template, (hole) => hole.kind === 'prop') }),
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

// The edit of a `{...args}` spread, which prints the props one per line when they are long. It
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
  const holes = props.map(([arg, prop]) => mark({ kind: 'prop', arg }, prop));
  // The args a control adds stand `space` apart, as the props of the spread do.
  const added = (space: string) =>
    mark({ kind: 'props', except: printed, separator: space, spread: true }, '', space);
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
    // The line goes, so the args a control adds go on lines of their own.
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
    case 'AttachTag':
      return [node.expression];
    case 'ConstTag':
      return node.declaration.declarations.flatMap((declaration) =>
        declaration.init ? [declaration.init] : []
      );
    case 'ClassDirective':
    case 'OnDirective':
    case 'UseDirective':
    case 'TransitionDirective':
    case 'AnimateDirective':
      // `on:`, `use:`, `transition:` and `animate:` may omit their parameter expression.
      return node.expression ? [node.expression] : [];
    default:
      return [];
  }
}

// Replace each read of the story args in an expression with the source of the value it reads, or
// return `undefined` when the expression reads no story args. A read of an arg the story does not
// set stays as written, unless `argsComplete`; `substituted` says whether any read was replaced, and
// `args` names the arg of each read. `marked` has a hole for each read, and `single` is set when the expression is one whole read: its
// arg, the `path` of the member of it that it reads, if any, and the `string` it reads, if any.
function replaceArgsReads(
  expression: string,
  { args, name, aliases, typescript, argsComplete, mark }: Reads
):
  | {
      value: string;
      marked: string;
      substituted: boolean;
      args: string[];
      single?: { arg: string; path?: string[]; string?: string };
    }
  | undefined {
  // The parentheses let an object literal or a sequence parse as one expression.
  const editor = new SourceEditor(`(${expression})`, scriptFile(typescript));
  const edits: (Edit & {
    node?: Node;
    marked: string;
    arg: string;
    place: SvelteHolePlace;
    substituted: boolean;
  })[] = [];
  // A read of `arg` from `start` to `end`, which the snippet prints as `read`, or keeps as written.
  const push = (
    arg: string,
    start: number,
    end: number,
    read: { value: string; node?: Node } | undefined,
    { path, property }: { path?: string[]; property?: string } = {}
  ) => {
    const value =
      read === undefined
        ? expression.slice(start, end)
        : property === undefined
          ? read.value
          : `${property}: ${read.value}`;
    const place: SvelteHolePlace =
      property === undefined
        ? { kind: 'value', ...(path && { path }) }
        : { kind: 'property', ...(property !== arg && { name: property }) };
    edits.push({
      start,
      end,
      value,
      node: property === undefined ? read?.node : undefined,
      marked: mark({ ...place, arg }, value),
      arg,
      place,
      substituted: read !== undefined,
    });
  };
  // The value of an arg that the template parameter destructures.
  const valueOf = (key: string): { value: string; node?: Node } | undefined => {
    if (key in args) return printRead(args[key], []);
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
          ? printRead(args[key], members)
          : argsComplete
            ? { value: 'undefined' }
            : undefined;
      push(key, node.start - 1, node.end - 1, read, {
        ...(members.length > 0 && { path: members }),
      });
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
    only.place.kind !== 'property' &&
    expression.slice(0, only.start).trim() === '' &&
    expression.slice(only.end).trim() === '';
  const string =
    only.node?.type === 'Literal' && typeof only.node.value === 'string'
      ? only.node.value
      : undefined;
  return {
    value: applyEdits(expression, edits),
    marked: applyEdits(
      expression,
      edits.map((edit) => ({ ...edit, value: edit.marked }))
    ),
    substituted: edits.some((edit) => edit.substituted),
    args: edits.map((edit) => edit.arg),
    ...(whole && {
      single: {
        arg: only.arg,
        ...(only.place.kind === 'value' && only.place.path && { path: only.place.path }),
        ...(string !== undefined && { string }),
      },
    }),
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
function printRead(value: Node, keys: string[]): { value: string; node?: Node } {
  let node = unwrapExpression(value);
  let rest = keys;
  while (rest.length) {
    const member = memberOf(node, rest[0]);
    if (!member) break;
    node = unwrapExpression(member);
    rest = rest.slice(1);
  }
  const accessors = printAccessors(rest);
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
