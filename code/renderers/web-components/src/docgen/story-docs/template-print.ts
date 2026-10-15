import type { types as t } from 'storybook/internal/babel';
import { fillWithStoryArgs, sourceOf } from 'storybook/internal/csf-tools';
import { hole } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { fillTemplate } from '../../docs/fill-template.ts';
import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { evaluateArgValue } from './arg-values.ts';
import { fieldDefault, pairedAttribute } from './classify-args.ts';
import type { HtmlAttribute, HtmlNode } from './html-tree.ts';
import { parseHtml, printHtml } from './html-tree.ts';
import { printAttribute, printRootListenerScript } from './print-element.ts';
import type { HoleContext, HoleValue } from './template-holes.ts';
import {
  attributeValue,
  collectReferencedArgs,
  escapeText,
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
  /**
   * The html next prints, with a hole wherever it prints an arg the template reads whole. It is laid
   * out as the story's own args fill it, so that fill is next's snippet.
   */
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
  markers: Map<string, t.Expression>;
  properties: Set<string>;
  referenced: Set<string>;
  unresolved: Set<string>;
}

export function printHtmlTemplate(
  template: HtmlTemplate,
  storyArgs: Record<string, t.Node>,
  declaration: ManifestDeclaration
): HtmlTemplateRenderResult {
  const state = printNodes(
    template,
    { bindings: template.bindings, declaration, scope: template.scope, storyArgs },
    true
  );
  const html = printHtml(state.nodes, ownFill(storyArgs));
  const script = printRootListenerScript(state.listeners);

  return {
    ...(state.falseDefaults.size === 0 ? {} : { falseDefaults: [...state.falseDefaults] }),
    listeners: state.listeners,
    ...(state.listenersNotShown.size === 0
      ? {}
      : { listenersNotShown: [...state.listenersNotShown] }),
    properties: [...state.properties],
    referenced: [...state.referenced],
    template: script ? `${html}\n${script}` : html,
    unresolved: [...state.unresolved],
  };
}

/** Fills html with the story's own args, as its static snippet; html it cannot fill as it is. */
export const ownFill = (storyArgs: Record<string, t.Node>) => {
  let own: Args = {};
  fillWithStoryArgs('', storyArgs, (_, args) => ((own = args), ''));
  return (html: string) => {
    try {
      return fillTemplate(html, own);
    } catch {
      return html;
    }
  };
};

// The html nodes of a template, with a hole for each arg it reads whole.
const printNodes = (
  template: HtmlTemplate,
  context: PrintContext,
  allowRootListeners: boolean
): TemplatePrintState & { nodes: HtmlNode[] } => {
  const scopedContext = { ...context, bindings: template.bindings, scope: template.scope };
  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const markers = new Map<string, t.Expression>();
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
  return { ...state, nodes };
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
    if (next) {
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
    const arg = wholeArg(state.markers.get(markersIn(attribute.value, state)[0]!), state);
    if (arg !== undefined) {
      const name = attribute.name.slice(1);
      return { hole: hole('bool', word(name), word(arg)), name, value: undefined };
    }
    const value = resolveFirstMarker(attribute.value, state);
    return value && isTruthyAttributeValue(value)
      ? { name: attribute.name.slice(1), value: undefined }
      : undefined;
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
    const single = markers.length === 1 && attribute.value === markers[0];
    const value = single ? resolveFirstMarker(attribute.value, state) : undefined;
    const falseDefault = fieldDefault(property, state.context.declaration) === 'true';
    const arg = single ? wholeArg(state.markers.get(markers[0]!), state) : undefined;
    if (arg !== undefined) {
      if (value?.kind === 'value' && value.value === false && falseDefault) {
        state.falseDefaults.add(property);
      }
      return {
        hole: hole('attr', word(paired), word(arg), 'field'),
        name: paired,
        value: undefined,
      };
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
    if (resolved.value === false && falseDefault) {
      state.falseDefaults.add(property);
    }
    return attributeFromPrinted(
      printAttribute({ name: paired, value: resolved.value, viaField: true })
    );
  }

  const markers = markersIn(attribute.value, state);
  const singleDynamicValue = markers.length === 1 && attribute.value === markers[0];
  // `name=${ifDefined(args.x)}` is the attribute while the arg is set.
  const only = singleDynamicValue ? state.markers.get(markers[0]!) : undefined;
  const defined =
    only && isIfDefinedCall(only, state.context.bindings)
      ? wholeArg(only.arguments[0], state)
      : undefined;
  if (defined !== undefined) {
    return {
      hole: hole('attr', word(attribute.name), word(defined), 'defined'),
      name: attribute.name,
      value: undefined,
    };
  }
  let text = attribute.value;
  for (const marker of markers) {
    const expression = state.markers.get(marker);
    if (!expression) {
      continue;
    }
    const arg = wholeArg(expression, state);
    if (arg !== undefined) {
      text = text.replace(marker, hole('quoted', word(arg)));
      continue;
    }
    const value = resolveMarkerValue(expression, state);
    if (value.kind === 'function') {
      state.unresolved.add(sourceOf(expression));
      return undefined;
    }
    if (value.kind === 'nothing') {
      return undefined;
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
    const valueText =
      resolved.value === null || resolved.value === undefined ? '' : String(resolved.value);
    text = text.replace(marker, valueText);
  }
  return { name: attribute.name, value: text };
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
    if (arg !== undefined) {
      // Next prints the text of a lit template, and the html of a string template.
      const text = state.lit ? hole('text', word(arg)) : hole('slot', 'default', word(arg));
      nodes.push({ kind: 'text', text });
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
      const nested = printNodes(value.template, state.context, false);
      nested.properties.forEach((property) => state.properties.add(property));
      nested.referenced.forEach((arg) => state.referenced.add(arg));
      nested.unresolved.forEach((source) => state.unresolved.add(source));
      nested.listenersNotShown.forEach((listener) => state.listenersNotShown.add(listener));
      return nested.nodes;
    }
    case 'unresolved':
      state.unresolved.add(value.source);
      return [];
    case 'value':
      if (value.value === null || value.value === undefined || value.value === '') {
        return [];
      }
      if (Array.isArray(value.value)) {
        const text = value.value.map((item) => item ?? '').join('');
        return state.lit ? [{ kind: 'text', text: escapeText(text) }] : parseHtml(text);
      }
      return state.lit
        ? [{ kind: 'text', text: escapeText(String(value.value)) }]
        : parseHtml(String(value.value));
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
};

/**
 * The arg an expression reads whole, whose value next prints as it is, so the template has a hole
 * for it; but for a function, of which next prints no value.
 */
const wholeArg = (
  expression: t.Expression | undefined,
  state: TemplatePrintState
): string | undefined => {
  const arg = expression && argReferenceForExpression(expression, state.context.scope);
  const node = arg && state.context.storyArgs[arg.name];
  if (!arg || arg.path.length > 0 || (node && evaluateArgValue(node).kind === 'function')) {
    return undefined;
  }
  state.referenced.add(arg.name);
  return arg.name;
};

// A word of a hole: a name as it is, else URI-encoded, so a hole holds no quote or space.
const word = (name: string) => (/^[\w$-]+$/.test(name) ? name : `%${encodeURIComponent(name)}`);

const resolveMarkerValue = (expression: t.Expression, state: TemplatePrintState): HoleValue => {
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
      state.unresolved.add(sourceOf(expression));
    }
    next = next.replace(marker, '');
  }
  return next;
};

const unresolvedMarkers = (text: string, state: TemplatePrintState): void => {
  for (const marker of markersIn(text, state)) {
    const expression = state.markers.get(marker);
    if (expression) {
      state.unresolved.add(sourceOf(expression));
    }
  }
};

const containsMarker = (text: string, state: TemplatePrintState): boolean =>
  markersIn(text, state).length > 0;

const markersIn = (text: string, state: TemplatePrintState): string[] => [
  ...new Set(
    [...text.matchAll(/__STORYBOOK_HOLE_[0-9a-z]+_[0-9a-z]+_\d+__/g)]
      .map(([marker]) => marker)
      .filter((marker) => state.markers.has(marker))
  ),
];

const markerSources = (markers: string[], state: TemplatePrintState): string =>
  markers
    .map((marker) => state.markers.get(marker))
    .filter((expression): expression is t.Expression => expression !== undefined)
    .map(sourceOf)
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
