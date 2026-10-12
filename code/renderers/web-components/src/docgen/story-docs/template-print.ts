import { types as t } from 'storybook/internal/babel';
import { sourceOf, unwrapExpression } from 'storybook/internal/csf-tools';

import type { ManifestDeclaration } from '../component-docgen/manifest/types.ts';
import { fieldDefault, pairedAttribute } from './classify-args.ts';
import type { HtmlAttribute, HtmlNode } from './html-tree.ts';
import { parseHtml, printHtml } from './html-tree.ts';
import {
  escapeAttribute,
  escapeTemplateText,
  escapeText,
  printAttribute,
  spreadHole,
} from '../../docs/template-format.ts';
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
import { aliasValueForIdentifier, argReferenceForExpression } from './template-scope.ts';
import { argPathSource, normalizeExpression, TemplateHoles } from './template-text.ts';

export interface HtmlTemplateRenderResult {
  falseDefaults?: string[];
  listeners: { event: string; handler: string }[];
  listenersNotShown?: string[];
  properties: string[];
  referenced: string[];
  snippet: string;
  // Set when every part of the snippet that reads args can be a hole.
  template?: string;
  unresolved: string[];
}

type DynamicAttribute = HtmlAttribute & { value: string };

interface PrintContext extends HoleContext {
  declaration: ManifestDeclaration;
}

interface TemplatePrintState {
  context: PrintContext;
  listeners: HtmlTemplateRenderResult['listeners'];
  falseDefaults: Set<string>;
  // How often the snippet left out something it could not show, counting repeats.
  gaps: number;
  // Unset while printing only the snippet, as for a branch the snippet picked.
  holes?: TemplateHoles;
  listenersNotShown: Set<string>;
  lit: boolean;
  markers: Map<string, t.Expression>;
  properties: Set<string>;
  referenced: Set<string>;
  rootListenerHoles: number[];
  unresolved: Set<string>;
}

// The snippet's and the template's side of one spot in the html; the same node where they agree.
interface Printed<T> {
  snippet: T;
  template: T;
}

export function printHtmlTemplate(
  template: HtmlTemplate,
  storyArgs: Record<string, t.Node>,
  declaration: ManifestDeclaration
): HtmlTemplateRenderResult {
  const holes = new TemplateHoles();
  const { result, nodes, script } = resolveTemplate(
    template,
    { bindings: template.bindings, declaration, scope: template.scope, storyArgs },
    holes,
    true
  );
  if (holes.blocked || holes.size === 0) {
    return result;
  }
  const html = holes.print(nodes);
  return { ...result, template: script ? `${html}\n${escapeTemplateText(script)}` : html };
}

const resolveTemplate = (
  template: HtmlTemplate,
  context: PrintContext,
  holes: TemplateHoles | undefined,
  allowRootListeners: boolean
): { gaps: number; nodes: HtmlNode[]; result: HtmlTemplateRenderResult; script?: string } => {
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
    gaps: 0,
    holes,
    listeners: [],
    listenersNotShown: new Set(),
    lit: template.lit,
    markers,
    properties: new Set(),
    referenced: new Set(),
    rootListenerHoles: [],
    unresolved: new Set(),
  };

  for (const expression of template.expressions) {
    collectReferencedArgs(expression, scopedContext.scope).forEach((arg) =>
      state.referenced.add(arg)
    );
  }

  const nodes = resolveTemplateNodes(parseHtml(source), state, 0);
  const hostRoots = nodes.snippet.filter(
    (node) => node.kind === 'element' && node.name !== 'style'
  );
  const rootElements = nodes.snippet.filter(
    (node) => node.kind === 'element' || node.kind === 'rawText'
  );
  const rootListenersAttachToHost =
    allowRootListeners && hostRoots.length === 1 && rootElements.at(-1) === hostRoots[0];
  if (!rootListenersAttachToHost && state.listeners.length > 0) {
    state.listeners.forEach((listener) => addGap(state, 'listenersNotShown', `@${listener.event}`));
    state.listeners = [];
  }
  if (rootListenersAttachToHost) {
    state.rootListenerHoles.forEach((index) => holes?.drop(index));
  }
  const script = printRootListenerScript(state.listeners);
  const snippet = printHtml(nodes.snippet);

  return {
    gaps: state.gaps,
    nodes: nodes.template,
    script,
    result: {
      ...(state.falseDefaults.size === 0 ? {} : { falseDefaults: [...state.falseDefaults] }),
      listeners: state.listeners,
      ...(state.listenersNotShown.size === 0
        ? {}
        : { listenersNotShown: [...state.listenersNotShown] }),
      properties: [...state.properties],
      referenced: [...state.referenced],
      snippet: script ? `${snippet}\n${script}` : snippet,
      unresolved: [...state.unresolved],
    },
  };
};

const resolveTemplateNodes = (
  nodes: HtmlNode[],
  state: TemplatePrintState,
  depth: number
): Printed<HtmlNode[]> => {
  const printed = nodes.map((node) => resolveTemplateNode(node, state, depth));
  return {
    snippet: printed.flatMap(({ snippet }) => snippet),
    template: printed.flatMap(({ template }) => template),
  };
};

const resolveTemplateNode = (
  node: HtmlNode,
  state: TemplatePrintState,
  depth: number
): Printed<HtmlNode[]> => {
  switch (node.kind) {
    case 'element': {
      const attributes = resolveAttributes(node.name, node.attributes, state, depth);
      const children = resolveTemplateNodes(node.children, state, depth + 1);
      return {
        snippet: [{ ...node, attributes: attributes.snippet, children: children.snippet }],
        template: [{ ...node, attributes: attributes.template, children: children.template }],
      };
    }
    case 'text':
      return resolveTextNode(node.text, state);
    case 'comment':
    case 'rawText':
    case 'malformed': {
      const printed = [{ ...node, text: removeUnsupportedMarkers(node.text, state) }];
      return { snippet: printed, template: printed };
    }
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
): Printed<HtmlAttribute[]> => {
  const resolved: Printed<HtmlAttribute[]> = { snippet: [], template: [] };
  for (const attribute of attributes) {
    const next = resolveAttribute(tag, attribute, state, depth);
    if (next.snippet) {
      upsertAttribute(resolved.snippet, next.snippet);
    }
    if (next.template) {
      upsertAttribute(resolved.template, next.template);
    }
  }
  return resolved;
};

const resolveAttribute = (
  tag: string,
  attribute: HtmlAttribute,
  state: TemplatePrintState,
  depth: number
): Partial<Printed<HtmlAttribute>> => {
  if (containsMarker(attribute.name, state)) {
    unresolvedMarkers(attribute.name, state);
    block(state);
    return {};
  }
  if (attribute.value === undefined || !containsMarker(attribute.value, state)) {
    return { snippet: attribute, template: attribute };
  }
  const dynamic = { ...attribute, value: attribute.value };
  const { gaps } = state;
  const snippet = snippetAttribute(tag, dynamic, state, depth);
  const expressions = markersIn(dynamic.value, state).map((marker) => state.markers.get(marker)!);
  const listener = state.lit && attribute.name.startsWith('@');
  if (
    !state.holes ||
    (!listener &&
      state.gaps === gaps &&
      expressions.every((expression) => !readsArgs(expression, state)))
  ) {
    return { snippet, template: snippet };
  }
  return { snippet, template: templateAttribute(dynamic, snippet, state, state.holes, depth) };
};

const snippetAttribute = (
  tag: string,
  attribute: DynamicAttribute,
  state: TemplatePrintState,
  depth: number
): HtmlAttribute | undefined => {
  const prefix = state.lit ? attribute.name[0] : undefined;
  if (prefix === '?') {
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
      addGap(state, 'listenersNotShown', `@${event}`);
    }
    return undefined;
  }
  if (prefix === '.') {
    const property = attribute.name.slice(1);
    const paired = pairedAttribute(property, state.context.declaration);
    if (!paired) {
      addGap(state, 'properties', property);
      return undefined;
    }
    const markers = markersIn(attribute.value, state);
    const value =
      markers.length === 1 && attribute.value === markers[0]
        ? resolveFirstMarker(attribute.value, state)
        : undefined;
    if (!value || value.kind === 'unresolved') {
      addGap(
        state,
        'unresolved',
        value?.kind === 'unresolved' ? value.source : markerSources(markers, state)
      );
      return undefined;
    }
    const resolved = attributeValue(value, state.context, state.referenced);
    if (resolved.kind === 'unresolved') {
      addGap(state, 'unresolved', resolved.source);
      return undefined;
    }
    if (resolved.value === false && fieldDefault(property, state.context.declaration) === 'true') {
      state.falseDefaults.add(property);
    }
    return attributeFromPrinted(
      printAttribute({ name: paired, value: resolved.value, viaField: true })
    );
  }

  const markers = markersIn(attribute.value, state);
  const singleDynamicValue = markers.length === 1 && attribute.value === markers[0];
  let text = attribute.value;
  for (const marker of markers) {
    const expression = state.markers.get(marker);
    if (!expression) {
      continue;
    }
    const value = resolveMarkerValue(expression, state);
    if (value.kind === 'function') {
      addGap(state, 'unresolved', sourceOf(expression));
      return undefined;
    }
    if (value.kind === 'nothing') {
      return undefined;
    }
    if (value.kind === 'unresolved') {
      addGap(state, 'unresolved', value.source);
      return undefined;
    }
    const resolved = attributeValue(value, state.context, state.referenced);
    if (resolved.kind === 'unresolved') {
      addGap(state, 'unresolved', resolved.source);
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
    text = text.replace(marker, () => valueText);
  }
  return { name: attribute.name, value: text };
};

// `name=${args.x}`, `?name=${…}`, `.name=${…}` and `@name=${…}` keep their lit binding with the
// arg path normalized; a `.prop` paired with an attribute prints as that attribute, as in the
// snippet, and a root listener that the snippet's `<script>` shows is left out.
const templateAttribute = (
  attribute: DynamicAttribute,
  snippet: HtmlAttribute | undefined,
  state: TemplatePrintState,
  holes: TemplateHoles,
  depth: number
): HtmlAttribute | undefined => {
  const display = snippet ? printedAttribute(snippet) : '';
  const markers = markersIn(attribute.value, state);
  const expressions = markers.map((marker) => state.markers.get(marker)!);
  const single = markers.length === 1 && attribute.value === markers[0];
  const prefix = /^[?.@]/.test(attribute.name) ? attribute.name[0] : undefined;
  if (prefix && (!state.lit || !single)) {
    holes.blocked = true;
    return undefined;
  }

  if (!single) {
    return interpolatedAttribute(attribute, display, state, holes);
  }

  const [expression] = expressions as [t.Expression];
  const reference = argReferenceForExpression(expression, state.context.scope);
  if (prefix === '.' && reference && reference.path.length === 0) {
    const property = attribute.name.slice(1);
    const paired = pairedAttribute(property, state.context.declaration);
    if (paired) {
      const binding = {
        kind: 'attribute',
        name: paired,
        reflected: true,
        defaultsToTrue: fieldDefault(property, state.context.declaration) === 'true',
      } as const;
      return holes.attribute(spreadHole(new Map([[reference.name, binding]])), display).node;
    }
  }
  const hole = holeSource(expression, state);
  if (hole === undefined) {
    return undefined;
  }
  const printed = holes.attribute(`${attribute.name}=\${${hole}}`, display);
  if (prefix === '@' && depth === 0) {
    state.rootListenerHoles.push(printed.index);
  }
  return printed.node;
};

// `class="card ${args.tone}"`: the value's text with the holes that read args left in it. An
// unquoted value that starts with one is left out of the snippet when the arg is unset, which the
// filler cannot tell, so it gets no template.
const interpolatedAttribute = (
  attribute: DynamicAttribute,
  display: string,
  state: TemplatePrintState,
  holes: TemplateHoles
): HtmlAttribute | undefined => {
  const markers = markersIn(attribute.value, state);
  const leading = markers.find((marker) => attribute.value.startsWith(marker));
  if (!attribute.quoted && leading && readsArgs(state.markers.get(leading)!, state)) {
    holes.blocked = true;
    return undefined;
  }
  let value = escapeTemplateText(escapeAttribute(attribute.value));
  for (const marker of markers) {
    const expression = state.markers.get(marker)!;
    const text = readsArgs(expression, state) ? undefined : staticAttributeText(expression, state);
    const hole = text === undefined ? holeSource(expression, state) : undefined;
    if (text === undefined && hole === undefined) {
      return undefined;
    }
    const replacement =
      text === undefined ? `\${${hole}}` : escapeTemplateText(escapeAttribute(text));
    value = value.replace(marker, () => replacement);
  }
  return holes.attribute(`${attribute.name}="${value}"`, display).node;
};

const staticAttributeText = (expression: t.Expression, state: TemplatePrintState) => {
  const value = resolveHoleValue(expression, state.context);
  const resolved = value.kind === 'unresolved' ? value : attributeValue(value, state.context);
  return resolved.kind === 'value' ? String(resolved.value ?? '') : undefined;
};

const resolveTextNode = (text: string, state: TemplatePrintState): Printed<HtmlNode[]> => {
  const markers = markersIn(text, state);
  if (markers.length === 0) {
    const node: HtmlNode = { kind: 'text', text };
    return { snippet: [node], template: [node] };
  }

  const nodes: Printed<HtmlNode[]> = { snippet: [], template: [] };
  let rest = text;
  for (const marker of markers) {
    const [before, after] = rest.split(marker);
    if (before) {
      nodes.snippet.push({ kind: 'text', text: before });
      nodes.template.push({ kind: 'text', text: before });
    }
    const expression = state.markers.get(marker);
    if (expression) {
      const child = childNodes(expression, state);
      nodes.snippet.push(...child.snippet);
      nodes.template.push(...child.template);
    }
    rest = after ?? '';
  }
  if (rest) {
    nodes.snippet.push({ kind: 'text', text: rest });
    nodes.template.push({ kind: 'text', text: rest });
  }
  return nodes;
};

const childNodes = (expression: t.Expression, state: TemplatePrintState): Printed<HtmlNode[]> => {
  const { gaps, holes } = state;
  const value = resolveMarkerValue(expression, state);
  if (value.kind === 'template' && isInlineTemplate(expression, state)) {
    return nestedTemplateNodes(value.template, state, holes);
  }
  const snippet = nodesForChildValue(value, state);
  if (!holes || (state.gaps === gaps && !readsArgs(expression, state))) {
    return { snippet, template: snippet };
  }
  const reference = argReferenceForExpression(expression, state.context.scope);
  const hole = reference
    ? state.lit
      ? argPathSource(reference)
      : `unsafeHTML(${argPathSource(reference)})`
    : holeSource(expression, state);
  if (hole === undefined) {
    return { snippet, template: [] };
  }
  return { snippet, template: [holes.text(`\${${hole}}`, printHtml(snippet))] };
};

// `${html`…`}` and `${alias}` of one: the nested html is printed in place, with its own holes.
const isInlineTemplate = (expression: t.Expression, state: TemplatePrintState) => {
  const unwrapped = unwrapExpression(expression);
  return t.isIdentifier(unwrapped)
    ? aliasValueForIdentifier(unwrapped, state.context.scope)?.kind === 'template'
    : t.isTaggedTemplateExpression(unwrapped) ||
        t.isTemplateLiteral(unwrapped) ||
        t.isStringLiteral(unwrapped);
};

const nestedTemplateNodes = (
  template: HtmlTemplate,
  state: TemplatePrintState,
  holes: TemplateHoles | undefined
): Printed<HtmlNode[]> => {
  const nested = resolveTemplate(template, state.context, holes, false);
  nested.result.properties.forEach((property) => state.properties.add(property));
  nested.result.referenced.forEach((arg) => state.referenced.add(arg));
  nested.result.unresolved.forEach((source) => state.unresolved.add(source));
  nested.result.listenersNotShown?.forEach((listener) => state.listenersNotShown.add(listener));
  state.gaps += nested.gaps;
  return {
    snippet: parseHtml(nested.result.snippet.replace(/<script>[\s\S]*<\/script>$/, '')),
    template: nested.nodes,
  };
};

const nodesForChildValue = (value: HoleValue, state: TemplatePrintState): HtmlNode[] => {
  switch (value.kind) {
    case 'empty':
    case 'nothing':
      return [];
    case 'function':
      addGap(state, 'unresolved', value.source ?? value.handler);
      return [];
    case 'template':
      return nestedTemplateNodes(value.template, state, undefined).snippet;
    case 'unresolved':
      addGap(state, 'unresolved', value.source);
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

// The arg path a hole reads (`args.x`, `ifDefined(args.x)`), or the hole's expression with its arg
// paths normalized; `undefined`, blocking the template, when it reads the args in another way.
const holeSource = (expression: t.Expression, state: TemplatePrintState): string | undefined => {
  const { scope } = state.context;
  const unwrapped = unwrapExpression(expression);
  const reference = argReferenceForExpression(expression, scope);
  if (reference) {
    return argPathSource(reference);
  }
  if (isIfDefinedCall(unwrapped, state.context.bindings)) {
    const inner = argReferenceForExpression(unwrapped.arguments[0], scope);
    if (inner) {
      return `ifDefined(${argPathSource(inner)})`;
    }
  }
  const normalized = normalizeExpression(expression, scope);
  if (normalized === undefined) {
    block(state);
  }
  return normalized;
};

const readsArgs = (expression: t.Expression, state: TemplatePrintState) =>
  collectReferencedArgs(expression, state.context.scope).size > 0;

const addGap = (
  state: TemplatePrintState,
  kind: 'listenersNotShown' | 'properties' | 'unresolved',
  value: string
) => {
  state[kind].add(value);
  state.gaps += 1;
};

const block = (state: TemplatePrintState) => {
  if (state.holes) {
    state.holes.blocked = true;
  }
};

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
      addGap(state, 'unresolved', sourceOf(expression));
      block(state);
    }
    next = next.replace(marker, '');
  }
  return next;
};

const unresolvedMarkers = (text: string, state: TemplatePrintState): void => {
  for (const marker of markersIn(text, state)) {
    const expression = state.markers.get(marker);
    if (expression) {
      addGap(state, 'unresolved', sourceOf(expression));
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

const printedAttribute = ({ name, value }: HtmlAttribute) =>
  value === undefined ? name : `${name}="${escapeAttribute(value)}"`;

const upsertAttribute = (attributes: HtmlAttribute[], next: HtmlAttribute): void => {
  const index = attributes.findIndex((attribute) => attribute.name === next.name);
  if (index === -1) {
    attributes.push(next);
    return;
  }
  attributes[index] = next;
};
