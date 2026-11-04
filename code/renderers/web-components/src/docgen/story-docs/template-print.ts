import type { ESTree as E, ESTreeNode as Node } from 'storybook/internal/csf-tools';
import { oneLineTextOf, unwrapExpression } from 'storybook/internal/csf-tools';
import { type TemplateHole, createHoleMarks } from 'storybook/internal/docs-tools';

import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { fieldDefault, pairedAttribute } from './classify-args.ts';
import { type HtmlAttribute, type HtmlNode, parseHtml } from '../../html-parse.ts';
import { printHtml } from './html-tree.ts';
import {
  type ArgRead,
  type HtmlHole,
  type HtmlHolePlace,
  type HtmlSnippetTemplate,
  type SnippetProperty,
  attrHole,
} from '../../snippet-holes.ts';
import {
  boundText,
  childText,
  escapeText,
  isTruthy,
  printAttribute,
} from '../../snippet-values.ts';
import { printRootListenerScript } from './print-element.ts';
import type { HoleContext, HoleValue } from './template-holes.ts';
import {
  attributeValue,
  collectReferencedArgs,
  isIfDefinedCall,
  isTruthyAttributeValue,
  listenerHandler,
  resolveHoleValue,
} from './template-holes.ts';
import type { HtmlTemplate } from './template-scope.ts';
import { argReferenceForExpression } from './template-scope.ts';

export interface HtmlTemplateRenderResult {
  falseDefaults?: string[];
  listeners: { event: string; handler: string }[];
  listenersNotShown?: string[];
  properties: string[];
  referenced: string[];
  snippet: string;
  // The snippet with a hole for each value it prints of an arg, after a `guard` hole for each arg
  // it reads where it cannot follow it, and before a `props` hole for the properties without an
  // attribute.
  template: HtmlSnippetTemplate | undefined;
  unresolved: string[];
}

interface PrintContext extends HoleContext {
  declaration: ManifestDeclaration;
}

// A print of the template, with the conditional each `choice` hole prints, by the hole's `at`, and
// whether the story's args take its first branch.
type Printed = HtmlTemplateRenderResult & { choices: Choice[] };
type Choice = { node: Node; truthy: boolean };

// What printing a template reads and collects. A template nested in it has its own `context`,
// `lit`, `markers` and `listeners`, and shares the rest.
interface TemplatePrintState {
  choices: Choice[];
  context: PrintContext;
  falseDefaults: Set<string>;
  // The args the template reads where the snippet prints no hole.
  guarded: Set<string>;
  // The listeners on the template's root elements.
  listeners: HtmlTemplateRenderResult['listeners'];
  listenersNotShown: Set<string>;
  lit: boolean;
  markers: Map<string, E.Expression>;
  properties: Set<string>;
  // The properties without an attribute an arg sets, which only the template prints.
  props: SnippetProperty[];
  referenced: Set<string>;
  unresolved: Set<string>;
}

export function printHtmlTemplate(
  template: HtmlTemplate,
  storyArgs: Record<string, Node>,
  declaration: ManifestDeclaration
): HtmlTemplateRenderResult {
  const context: PrintContext = {
    bindings: template.bindings,
    declaration,
    scope: template.scope,
    storyArgs,
  };
  const { choices, ...printed } = printTemplate(template, context);
  return {
    ...printed,
    template:
      printed.template &&
      withChoices(printed.template, choices, printed.unresolved, (flip) =>
        printTemplate(template, { ...context, flip })
      ),
  };
}

const printTemplate = (template: HtmlTemplate, context: PrintContext): Printed => {
  const state: TemplatePrintState = {
    choices: [],
    context,
    falseDefaults: new Set(),
    guarded: new Set(),
    listeners: [],
    listenersNotShown: new Set(),
    lit: template.lit,
    markers: new Map(),
    properties: new Set(),
    props: [],
    referenced: new Set(),
    unresolved: new Set(),
  };
  const { nodes, listeners } = resolveTemplate(template, state);
  // The script reaches the listeners of the one element the snippet prints before it.
  const hostRoots = nodes.filter((node) => node.kind === 'element' && node.name !== 'style');
  const rootElements = nodes.filter((node) => node.kind === 'element' || node.kind === 'rawText');
  const onHost = hostRoots.length === 1 && rootElements.at(-1) === hostRoots[0];
  if (!onHost) {
    listeners.forEach((listener) => state.listenersNotShown.add(`@${listener.event}`));
  }
  const script = printRootListenerScript(onHost ? listeners : []);
  const html = printHtml(nodes);
  const snippet = script ? `${html}\n${script}` : html;
  const marks = createHoleMarks<HtmlHolePlace>([snippet]);
  const guards = [...state.guarded].map((arg) => marks.mark({ kind: 'guard', arg }, ''));
  const props =
    state.props.length === 0
      ? ''
      : marks.mark({ kind: 'props', spread: true, properties: state.props }, '', '\n');
  const holes = guards.join('') + printHtml(nodes, marks);

  return {
    choices: state.choices,
    ...(state.falseDefaults.size === 0 ? {} : { falseDefaults: [...state.falseDefaults] }),
    listeners: onHost ? listeners : [],
    ...(state.listenersNotShown.size === 0
      ? {}
      : { listenersNotShown: [...state.listenersNotShown] }),
    properties: [...state.properties],
    referenced: [...state.referenced],
    snippet,
    template: marks.toTemplate(`${script ? `${holes}\n${script}` : holes}${props}`),
    unresolved: [...state.unresolved],
  };
};

// The nodes of `template`, printed in `parent`'s state, and the listeners on its root elements.
const resolveTemplate = (
  template: HtmlTemplate,
  parent: TemplatePrintState
): { nodes: HtmlNode[]; listeners: TemplatePrintState['listeners'] } => {
  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const markers = new Map<string, E.Expression>();
  const source = template.quasis.reduce((html, quasi, index) => {
    const expression = template.expressions[index];
    if (!expression) {
      return html + quasi;
    }
    const marker = `__STORYBOOK_HOLE_${nonce}_${index}__`;
    markers.set(marker, expression);
    return `${html}${quasi}${marker}`;
  }, '');
  const state: TemplatePrintState = {
    ...parent,
    context: { ...parent.context, bindings: template.bindings, scope: template.scope },
    listeners: [],
    lit: template.lit,
    markers,
  };
  for (const expression of template.expressions) {
    collectReferencedArgs(expression, template.scope).forEach((arg) => state.referenced.add(arg));
  }
  return { nodes: resolveTemplateNodes(parseHtml(source), state, 0), listeners: state.listeners };
};

// The template with the html of both branches in each `choice` hole: the one the story's args take
// as printed, and the other printed again with its conditional flipped. A conditional whose other
// branch prints code the server cannot resolve gets a `guard` hole instead.
const withChoices = (
  template: HtmlSnippetTemplate,
  choices: Choice[],
  unresolved: string[],
  printFlipped: (flip: Node) => Printed
): HtmlSnippetTemplate => {
  const guards: HtmlSnippetTemplate = [];
  const filled = template.map((segment) => {
    if (typeof segment === 'string' || segment.kind !== 'choice') {
      return segment;
    }
    const { at, ...hole } = segment as typeof segment & { at: number };
    const choice = choices[at]!;
    const flipped = printFlipped(choice.node);
    const other = flipped.template?.find(
      (flippedSegment) =>
        typeof flippedSegment !== 'string' && (flippedSegment as { at?: number }).at === at
    ) as TemplateHole<HtmlHolePlace> | undefined;
    if (!other || flipped.unresolved.some((source) => !unresolved.includes(source))) {
      guards.push({ kind: 'guard', arg: hole.arg!, text: '' });
      return segment.text;
    }
    const [truthy, falsy] = choice.truthy ? [hole.text, other.text] : [other.text, hole.text];
    return { ...hole, truthy, falsy };
  });
  return [...guards, ...filled];
};

const resolveTemplateNodes = (
  nodes: HtmlNode[],
  state: TemplatePrintState,
  depth: number
): HtmlNode[] => nodes.flatMap((node) => resolveTemplateNode(node, state, depth));

const resolveTemplateNode = (
  node: HtmlNode,
  state: TemplatePrintState,
  depth: number
): HtmlNode[] => {
  switch (node.kind) {
    case 'element':
      return [
        {
          ...node,
          attributes: resolveAttributes(node.name, node.attributes, state, depth),
          children: resolveTemplateNodes(node.children, state, depth + 1),
        },
      ];
    case 'text':
      return resolveTextNode(node.text, state);
    case 'comment':
      return [{ ...node, text: removeUnsupportedMarkers(node.text, state) }];
    case 'rawText':
      return [{ ...node, text: removeUnsupportedMarkers(node.text, state) }];
    case 'malformed':
      return [{ ...node, text: removeUnsupportedMarkers(node.text, state) }];
    case 'hole':
      return [node];
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const resolveAttributes = (
  tag: string,
  attributes: HtmlAttribute[],
  state: TemplatePrintState,
  depth: number
): HtmlAttribute[] => {
  // The attributes the static snippet prints, each replacing an earlier one of its name, then those
  // it leaves out, which only the template has, while it prints none of their name.
  const printed: HtmlAttribute[] = [];
  const omitted: HtmlAttribute[] = [];
  for (const attribute of attributes) {
    const next = resolveAttribute(tag, attribute, state, depth);
    if (next) {
      upsertAttribute(next.omitted ? omitted : printed, next);
    }
  }
  return [
    ...printed,
    ...omitted.filter((attribute) => !printed.some((other) => other.name === attribute.name)),
  ];
};

const resolveAttribute = (
  tag: string,
  attribute: HtmlAttribute,
  state: TemplatePrintState,
  depth: number
): HtmlAttribute | undefined => {
  if (containsMarker(attribute.name, state)) {
    unresolvedMarkers(attribute.name, state);
    guardMarkers(attribute.name, state);
    return undefined;
  }
  if (attribute.value === undefined || !containsMarker(attribute.value, state)) {
    return attribute;
  }

  const prefix = state.lit ? attribute.name[0] : undefined;
  if (prefix === '?') {
    const value = resolveFirstMarker(attribute.value, state);
    const name = attribute.name.slice(1);
    const shown = value && isTruthyAttributeValue(value);
    // `?name=${args.x}` is the attribute while the arg is truthy.
    const read = singleArg(attribute.value, value, state);
    if (read !== undefined) {
      return {
        name,
        value: undefined,
        hole: { kind: 'bool', ...read, ...(name !== read.arg && { name }) },
        ...(shown ? {} : { omitted: true }),
      };
    }
    guardMarkers(attribute.value, state);
    return shown ? { name, value: undefined } : undefined;
  }
  if (prefix === '@') {
    const value = resolveFirstMarker(attribute.value, state);
    const event = attribute.name.slice(1);
    if (depth === 0) {
      state.listeners.push({
        event,
        handler: value ? listenerHandler(value) : '() => {}',
      });
    } else {
      state.listenersNotShown.add(`@${event}`);
    }
    return undefined;
  }
  if (prefix === '.') {
    const property = attribute.name.slice(1);
    const paired = pairedAttribute(property, state.context.declaration);
    const markers = markersIn(attribute.value, state);
    if (!paired) {
      // Html sets no property, so the static snippet leaves it out; the template sets it in a
      // script once a control changes the arg it reads.
      state.properties.add(property);
      const only =
        markers.length === 1 && attribute.value === markers[0]
          ? state.markers.get(markers[0])
          : undefined;
      const read = only && argReferenceForExpression(only, state.context.scope);
      if (read) {
        state.props.push({ ...argRead(read), name: property, tag });
      } else {
        guardMarkers(attribute.value, state);
      }
      return undefined;
    }
    const value =
      markers.length === 1 && attribute.value === markers[0]
        ? resolveFirstMarker(attribute.value, state)
        : undefined;
    const read = value && singleArg(attribute.value, value, state);
    if (read === undefined) {
      guardMarkers(attribute.value, state);
    }
    if (!value || value.kind === 'unresolved') {
      state.unresolved.add(
        value?.kind === 'unresolved' ? value.source : markerSources(markers, state)
      );
      return undefined;
    }
    const resolved = attributeValue(value, state.context, state.referenced);
    if (resolved.kind === 'unresolved') {
      state.unresolved.add(resolved.source);
      return undefined;
    }
    if (resolved.value === false && fieldDefault(property, state.context.declaration) === 'true') {
      state.falseDefaults.add(property);
    }
    const printed = attributeFromPrinted(printAttribute(paired, resolved.value, true));
    // `.prop=${args.x}` prints the attribute the field reflects.
    return read === undefined
      ? printed
      : {
          ...(printed ?? { name: paired, value: undefined, omitted: true }),
          hole: attrHole(read, paired, 'field'),
        };
  }

  const markers = markersIn(attribute.value, state);
  const singleDynamicValue = markers.length === 1 && attribute.value === markers[0];
  // `name=${args.x}` is the attribute with the arg's text as its value; `name=${ifDefined(args.x)}`
  // is it while the arg is set; `name=${args.x ? a : b}` is the attribute each branch prints.
  const only = singleDynamicValue ? state.markers.get(markers[0]!) : undefined;
  const definedArg =
    only && isIfDefinedCall(only, state.context.bindings)
      ? wholeArg(only.arguments[0], state)
      : undefined;
  const boundArg = only && definedArg === undefined ? wholeArg(only, state) : undefined;
  const singleHole: HtmlHole | undefined =
    definedArg !== undefined
      ? attrHole(definedArg, attribute.name, 'defined')
      : boundArg !== undefined
        ? attrHole(boundArg, attribute.name, 'bind')
        : only && choiceHole(only, state);
  const withHole = (printed: HtmlAttribute | undefined): HtmlAttribute | undefined =>
    singleHole === undefined
      ? printed
      : {
          ...(printed ?? { name: attribute.name, value: undefined, omitted: true }),
          hole: singleHole,
        };
  let text = attribute.value;
  // The value with a `quoted` hole for each arg it reads whole, and a `choice` hole for each
  // conditional on one.
  let holeValue: HtmlSnippetTemplate = [attribute.value];
  for (const marker of markers) {
    const expression = state.markers.get(marker);
    if (!expression) {
      continue;
    }
    const value = resolveMarkerValue(expression, state);
    const hole: HtmlHole | undefined =
      singleHole === undefined ? quotedHole(expression, state) : undefined;
    if (singleHole === undefined && hole === undefined) {
      guard(expression, state);
    }
    if (value.kind === 'function') {
      state.unresolved.add(oneLineTextOf(expression));
      guardMarkers(attribute.value, state);
      return undefined;
    }
    if (value.kind === 'nothing') {
      return withHole(undefined);
    }
    if (value.kind === 'unresolved') {
      state.unresolved.add(value.source);
      guardMarkers(attribute.value, state);
      return undefined;
    }
    const resolved = attributeValue(value, state.context, state.referenced);
    if (resolved.kind === 'unresolved') {
      state.unresolved.add(resolved.source);
      guardMarkers(attribute.value, state);
      return undefined;
    }
    if (
      !attribute.quoted &&
      !singleDynamicValue &&
      resolved.value === undefined &&
      text.startsWith(marker)
    ) {
      guardMarkers(attribute.value, state);
      return undefined;
    }
    const valueText = boundText(resolved.value);
    text = text.replace(marker, valueText);
    holeValue = replaceMarker(holeValue, marker, hole ? { ...hole, text: valueText } : valueText);
  }
  return withHole({
    name: attribute.name,
    value: text,
    ...(holeValue.some((segment) => typeof segment !== 'string') ? { holeValue } : {}),
  });
};

// The hole of an expression in a quoted attribute value.
const quotedHole = (expression: E.Expression, state: TemplatePrintState): HtmlHole | undefined => {
  const read = wholeArg(expression, state);
  return read ? { kind: 'quoted', ...read } : choiceHole(expression, state);
};

// `template` with `marker` in its code replaced by `segment`.
const replaceMarker = (
  template: HtmlSnippetTemplate,
  marker: string,
  segment: string | TemplateHole<HtmlHolePlace>
): HtmlSnippetTemplate =>
  template.flatMap((part) => {
    const index = typeof part === 'string' ? part.indexOf(marker) : -1;
    if (index === -1) {
      return [part];
    }
    const code = part as string;
    return [code.slice(0, index), segment, code.slice(index + marker.length)].filter(
      (piece) => piece !== ''
    );
  });

const resolveTextNode = (text: string, state: TemplatePrintState): HtmlNode[] => {
  const markers = markersIn(text, state);
  if (markers.length === 0) {
    return [{ kind: 'text', text }];
  }

  const nodes: HtmlNode[] = [];
  let rest = text;
  for (const marker of markers) {
    const [before, after] = rest.split(marker);
    if (before) {
      nodes.push({ kind: 'text', text: before });
    }
    const expression = state.markers.get(marker);
    if (expression) {
      const value = resolveMarkerValue(expression, state);
      const read = wholeArg(expression, state);
      // Next prints the text of a lit template, and the html of a string template.
      const hole: HtmlHole | undefined =
        read === undefined
          ? choiceHole(expression, state)
          : state.lit
            ? { kind: 'text', ...read }
            : { kind: 'html', ...read };
      // A nested template has holes of its own; one a conditional picks reads the test's arg.
      if (hole === undefined && (value.kind !== 'template' || value.arg !== undefined)) {
        guard(expression, state);
      }
      const printed = nodesForChildValue(value, state);
      nodes.push(
        ...(hole === undefined ? printed : [{ hole, kind: 'hole' as const, nodes: printed }])
      );
    }
    rest = after ?? '';
  }
  if (rest) {
    nodes.push({ kind: 'text', text: rest });
  }
  return nodes;
};

const nodesForChildValue = (value: HoleValue, state: TemplatePrintState): HtmlNode[] => {
  switch (value.kind) {
    case 'empty':
    case 'nothing':
      return [];
    case 'function':
      state.unresolved.add(value.source ?? value.handler);
      return [];
    case 'template': {
      // The snippet's script reaches only listeners on its root elements, which a nested template
      // does not print.
      const nested = resolveTemplate(value.template, state);
      nested.listeners.forEach((listener) => state.listenersNotShown.add(`@${listener.event}`));
      return nested.nodes;
    }
    case 'unresolved':
      state.unresolved.add(value.source);
      return [];
    case 'value': {
      if (value.value === null || value.value === undefined || value.value === '') {
        return [];
      }
      // An array that joins to no text is still a text node, which keeps lit text beside it on a
      // line of its own.
      const text = childText(value.value);
      return state.lit ? [{ kind: 'text', text: escapeText(text) }] : parseHtml(text);
    }
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
};

// The arg an expression reads whole, as `args.x`, `args.x.y` or a name a destructured parameter
// binds, whose value the snippet prints as it is: a value of the story's, or none. An arg the story
// writes as a function, or that a static pass cannot read, has no hole, as the snippet prints no
// value for it.
const wholeArg = (expression: E.Expression, state: TemplatePrintState): ArgRead | undefined => {
  const arg = argReferenceForExpression(expression, state.context.scope);
  if (!arg) {
    return undefined;
  }
  const value = resolveHoleValue(expression, state.context);
  return value.kind === 'value' || value.kind === 'empty' || value.kind === 'nothing'
    ? argRead(arg)
    : undefined;
};

const argRead = ({ name, path }: { name: string; path: string[] }): ArgRead => ({
  arg: name,
  ...(path.length > 0 && { path }),
});

// The arg a binding whose whole value is one expression reads whole.
const singleArg = (
  text: string,
  value: HoleValue | undefined,
  state: TemplatePrintState
): ArgRead | undefined => {
  const markers = markersIn(text, state);
  const expression =
    markers.length === 1 && text === markers[0] ? state.markers.get(markers[0]) : undefined;
  return expression && value && value.kind !== 'unresolved' && value.kind !== 'function'
    ? wholeArg(expression, state)
    : undefined;
};

// A `choice` hole for `${args.x ? a : b}`, where neither branch reads an arg, so the server prints
// both. Its `at` is the conditional's place in `state.choices`, which a print with that conditional
// flipped gives it too; `printHtmlTemplate` fills in the html of each branch.
const choiceHole = (expression: E.Expression, state: TemplatePrintState): HtmlHole | undefined => {
  const node = unwrapExpression(expression);
  if (node.type !== 'ConditionalExpression') {
    return undefined;
  }
  const test = argReferenceForExpression(node.test, state.context.scope);
  const reads = (branch: Node) => collectReferencedArgs(branch, state.context.scope).size > 0;
  if (!test || reads(node.consequent) || reads(node.alternate)) {
    return undefined;
  }
  const testValue = resolveHoleValue(node.test, state.context);
  const at = state.choices.push({
    node,
    truthy: testValue.kind === 'value' && isTruthy(testValue.value),
  });
  const branch = resolveHoleValue(node, state.context).kind;
  if (branch === 'unresolved' || branch === 'function') {
    return undefined;
  }
  return { kind: 'choice', ...argRead(test), truthy: '', falsy: '', at: at - 1 } as HtmlHole;
};

const resolveMarkerValue = (expression: E.Expression, state: TemplatePrintState): HoleValue => {
  const value = resolveHoleValue(expression, state.context);
  if (value.arg) {
    state.referenced.add(value.arg);
  }
  return value;
};

const resolveFirstMarker = (text: string, state: TemplatePrintState): HoleValue | undefined => {
  const marker = markersIn(text, state)[0];
  const expression = marker ? state.markers.get(marker) : undefined;
  return expression ? resolveMarkerValue(expression, state) : undefined;
};

const guard = (expression: E.Expression, state: TemplatePrintState): void =>
  collectReferencedArgs(expression, state.context.scope).forEach((arg) => state.guarded.add(arg));

const guardMarkers = (text: string, state: TemplatePrintState): void =>
  markersIn(text, state).forEach((marker) => guard(state.markers.get(marker)!, state));

const removeUnsupportedMarkers = (text: string, state: TemplatePrintState): string => {
  guardMarkers(text, state);
  let next = text;
  for (const marker of markersIn(text, state)) {
    const expression = state.markers.get(marker);
    if (expression) {
      state.unresolved.add(oneLineTextOf(expression));
    }
    next = next.replace(marker, '');
  }
  return next;
};

const unresolvedMarkers = (text: string, state: TemplatePrintState): void => {
  for (const marker of markersIn(text, state)) {
    const expression = state.markers.get(marker);
    if (expression) {
      state.unresolved.add(oneLineTextOf(expression));
    }
  }
};

const containsMarker = (text: string, state: TemplatePrintState): boolean =>
  markersIn(text, state).length > 0;

const markersIn = (text: string, state: TemplatePrintState): string[] =>
  [...state.markers.keys()].filter((marker) => text.includes(marker));

const markerSources = (markers: string[], state: TemplatePrintState): string =>
  markers
    .map((marker) => state.markers.get(marker))
    .filter((expression): expression is E.Expression => expression !== undefined)
    .map(oneLineTextOf)
    .join(', ');

const attributeFromPrinted = (attribute: string | undefined): HtmlAttribute | undefined => {
  if (!attribute) {
    return undefined;
  }
  const [node] = parseHtml(`<x ${attribute}></x>`);
  return node?.kind === 'element' ? node.attributes[0] : undefined;
};

const upsertAttribute = (attributes: HtmlAttribute[], next: HtmlAttribute): void => {
  const index = attributes.findIndex((attribute) => attribute.name === next.name);
  if (index === -1) {
    attributes.push(next);
    return;
  }
  attributes[index] = next;
};
