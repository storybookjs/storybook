import type { ESTree as E, ESTreeNode as Node } from 'storybook/internal/csf-tools';
import { oneLineTextOf } from 'storybook/internal/csf-tools';
import { hole, holeWord } from 'storybook/internal/docs-tools';

import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { fieldDefault, pairedAttribute } from './classify-args.ts';
import { type HtmlAttribute, type HtmlNode, parseHtml } from '../../html-parse.ts';
import { printHtml } from './html-tree.ts';
import { boundText, childText, escapeText, printAttribute } from '../../snippet-values.ts';
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
  /** The snippet with a hole wherever it prints an arg the template reads whole. */
  template: string;
  unresolved: string[];
}

interface PrintContext extends HoleContext {
  declaration: ManifestDeclaration;
}

interface TemplatePrintState {
  context: PrintContext;
  listeners: HtmlTemplateRenderResult['listeners'];
  falseDefaults: Set<string>;
  listenersNotShown: Set<string>;
  lit: boolean;
  markers: Map<string, E.Expression>;
  properties: Set<string>;
  referenced: Set<string>;
  unresolved: Set<string>;
}

export function printHtmlTemplate(
  template: HtmlTemplate,
  storyArgs: Record<string, Node>,
  declaration: ManifestDeclaration
): HtmlTemplateRenderResult {
  return printTemplate(template, {
    bindings: template.bindings,
    declaration,
    scope: template.scope,
    storyArgs,
  });
}

const printTemplate = (template: HtmlTemplate, context: PrintContext): HtmlTemplateRenderResult => {
  return printTemplateWithListeners(template, context, true);
};

const printTemplateWithListeners = (
  template: HtmlTemplate,
  context: PrintContext,
  allowRootListeners: boolean
): HtmlTemplateRenderResult => {
  const scopedContext = { ...context, bindings: template.bindings, scope: template.scope };
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
    context: scopedContext,
    falseDefaults: new Set(),
    listeners: [],
    listenersNotShown: new Set(),
    lit: template.lit,
    markers,
    properties: new Set(),
    referenced: new Set(),
    unresolved: new Set(),
  };

  for (const expression of template.expressions) {
    collectReferencedArgs(expression, scopedContext.scope).forEach((arg) =>
      state.referenced.add(arg)
    );
  }

  const nodes = resolveTemplateNodes(parseHtml(source), state, 0);
  const hostRoots = nodes.filter((node) => node.kind === 'element' && node.name !== 'style');
  const rootElements = nodes.filter((node) => node.kind === 'element' || node.kind === 'rawText');
  const rootListenersAttachToHost =
    allowRootListeners && hostRoots.length === 1 && rootElements.at(-1) === hostRoots[0];
  if (!rootListenersAttachToHost && state.listeners.length > 0) {
    state.listeners.forEach((listener) => state.listenersNotShown.add(`@${listener.event}`));
    state.listeners = [];
  }
  const script = printRootListenerScript(state.listeners);
  const snippet = printHtml(nodes);
  const holes = printHtml(nodes, true);

  return {
    ...(state.falseDefaults.size === 0 ? {} : { falseDefaults: [...state.falseDefaults] }),
    listeners: state.listeners,
    ...(state.listenersNotShown.size === 0
      ? {}
      : { listenersNotShown: [...state.listenersNotShown] }),
    properties: [...state.properties],
    referenced: [...state.referenced],
    snippet: script ? `${snippet}\n${script}` : snippet,
    template: script ? `${holes}\n${script}` : holes,
    unresolved: [...state.unresolved],
  };
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
  const resolved: HtmlAttribute[] = [];
  for (const attribute of attributes) {
    const next = resolveAttribute(tag, attribute, state, depth);
    // An attribute the static snippet leaves out keeps one of the same name written before it.
    if (next && !(next.omitted && resolved.some((other) => other.name === next.name))) {
      upsertAttribute(resolved, next);
    }
  }
  return resolved;
};

const resolveAttribute = (
  tag: string,
  attribute: HtmlAttribute,
  state: TemplatePrintState,
  depth: number
): HtmlAttribute | undefined => {
  if (containsMarker(attribute.name, state)) {
    unresolvedMarkers(attribute.name, state);
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
    // `?name=${args.x}` is the attribute while the arg is truthy: `⟦bool name arg⟧`.
    const arg = singleArg(attribute.value, value, state);
    if (arg !== undefined) {
      return {
        name,
        value: undefined,
        hole: hole('bool', holeWord(name), holeWord(arg)),
        ...(shown ? {} : { omitted: true }),
      };
    }
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
    if (!paired) {
      state.properties.add(property);
      return undefined;
    }
    const markers = markersIn(attribute.value, state);
    const value =
      markers.length === 1 && attribute.value === markers[0]
        ? resolveFirstMarker(attribute.value, state)
        : undefined;
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
    // `.prop=${args.x}` prints the attribute the field reflects: `⟦attr name arg field⟧`.
    const arg = singleArg(attribute.value, value, state);
    return arg === undefined
      ? printed
      : {
          ...(printed ?? { name: paired, value: undefined, omitted: true }),
          hole: hole('attr', holeWord(paired), holeWord(arg), 'field'),
        };
  }

  const markers = markersIn(attribute.value, state);
  const singleDynamicValue = markers.length === 1 && attribute.value === markers[0];
  // `name=${args.x}` is the attribute with the arg's text as its value, `⟦attr name arg bind⟧`;
  // `name=${ifDefined(args.x)}` is it while the arg is set, `⟦attr name arg defined⟧`.
  const only = singleDynamicValue ? state.markers.get(markers[0]!) : undefined;
  const definedArg =
    only && isIfDefinedCall(only, state.context.bindings)
      ? wholeArg(only.arguments[0], state)
      : undefined;
  const singleHole =
    definedArg !== undefined
      ? hole('attr', holeWord(attribute.name), holeWord(definedArg), 'defined')
      : only && wholeArg(only, state) !== undefined
        ? hole('attr', holeWord(attribute.name), holeWord(wholeArg(only, state)!), 'bind')
        : undefined;
  const withHole = (printed: HtmlAttribute | undefined): HtmlAttribute | undefined =>
    singleHole === undefined
      ? printed
      : {
          ...(printed ?? { name: attribute.name, value: undefined, omitted: true }),
          hole: singleHole,
        };
  let text = attribute.value;
  // The value with a hole for each arg it reads whole, `⟦quoted arg⟧`.
  let holeText: string | undefined = attribute.value;
  for (const marker of markers) {
    const expression = state.markers.get(marker);
    if (!expression) {
      continue;
    }
    const value = resolveMarkerValue(expression, state);
    const arg = singleHole === undefined ? wholeArg(expression, state) : undefined;
    if (value.kind === 'function') {
      state.unresolved.add(oneLineTextOf(expression));
      return undefined;
    }
    if (value.kind === 'nothing') {
      return withHole(undefined);
    }
    if (value.kind === 'unresolved') {
      state.unresolved.add(value.source);
      return undefined;
    }
    const resolved = attributeValue(value, state.context, state.referenced);
    if (resolved.kind === 'unresolved') {
      state.unresolved.add(resolved.source);
      return undefined;
    }
    if (
      !attribute.quoted &&
      !singleDynamicValue &&
      resolved.value === undefined &&
      text.startsWith(marker)
    ) {
      return undefined;
    }
    const valueText = boundText(resolved.value);
    text = text.replace(marker, valueText);
    holeText = holeText.replace(
      marker,
      arg === undefined ? valueText : hole('quoted', holeWord(arg))
    );
  }
  return withHole({
    name: attribute.name,
    value: text,
    ...(holeText === text ? {} : { holeValue: holeText }),
  });
};

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
    const arg = expression && wholeArg(expression, state);
    if (expression && arg !== undefined) {
      // Next prints the text of a lit template, and the html of a string template.
      nodes.push({
        hole: state.lit ? hole('text', holeWord(arg)) : hole('html', holeWord(arg)),
        kind: 'hole',
        nodes: nodesForChildValue(resolveMarkerValue(expression, state), state),
      });
    } else if (expression) {
      nodes.push(...nodesForChildValue(resolveMarkerValue(expression, state), state));
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
      const nested = printTemplateWithListeners(value.template, state.context, false);
      nested.properties.forEach((property) => state.properties.add(property));
      nested.referenced.forEach((arg) => state.referenced.add(arg));
      nested.unresolved.forEach((source) => state.unresolved.add(source));
      nested.listenersNotShown?.forEach((listener) => state.listenersNotShown.add(listener));
      const nodes = parseHtml(nested.snippet.replace(/<script>[\s\S]*<\/script>$/, ''));
      // A nested template with holes is its template where its html goes.
      return nested.template === nested.snippet
        ? nodes
        : [
            {
              hole: nested.template.replace(/<script>[\s\S]*<\/script>$/, ''),
              kind: 'hole',
              nodes,
            },
          ];
    }
    case 'unresolved':
      state.unresolved.add(value.source);
      return [];
    case 'value': {
      const text = childText(value.value);
      if (text === '') {
        return [];
      }
      return state.lit ? [{ kind: 'text', text: escapeText(text) }] : parseHtml(text);
    }
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
};

/**
 * The arg an expression reads whole, as `args.x` or a name a destructured parameter binds, whose
 * value the snippet prints as it is: a value of the story's, or none. An arg the story writes as
 * a function, or that a static pass cannot read, has no hole, as next prints no value for it.
 */
const wholeArg = (expression: E.Expression, state: TemplatePrintState): string | undefined => {
  const arg = argReferenceForExpression(expression, state.context.scope);
  if (!arg || arg.path.length > 0) {
    return undefined;
  }
  const value = resolveHoleValue(expression, state.context);
  return value.kind === 'value' || value.kind === 'empty' || value.kind === 'nothing'
    ? arg.name
    : undefined;
};

// The arg a binding whose whole value is one expression reads whole.
const singleArg = (
  text: string,
  value: HoleValue | undefined,
  state: TemplatePrintState
): string | undefined => {
  const markers = markersIn(text, state);
  const expression =
    markers.length === 1 && text === markers[0] ? state.markers.get(markers[0]) : undefined;
  return expression && value && value.kind !== 'unresolved' && value.kind !== 'function'
    ? wholeArg(expression, state)
    : undefined;
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

const removeUnsupportedMarkers = (text: string, state: TemplatePrintState): string => {
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
