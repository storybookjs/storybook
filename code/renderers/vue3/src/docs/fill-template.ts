import {
  ARG_PATH_PATTERN,
  type FillSnippetTemplate,
  type PrintValueOptions,
  layoutAttributes,
  printArgPath,
  printValue,
  resolveArgPath,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { Comment, type VNode, camelize, isVNode } from 'vue';

import { escapeTextContent } from './escape-text-content.ts';
import { readArgsSpread } from './template-format.ts';

const ARG_PATH = new RegExp(ARG_PATH_PATTERN, 'g');
const WHOLE_ARG_PATH = new RegExp(String.raw`^\s*(${ARG_PATH_PATTERN})\s*$`);
const DIRECTIVE = /^(?::|@|#|v-)/;
const BINDING = /^(?::|v-bind:|@|v-on:)[\w:-]+$/;
// Vue lets the later of an attribute and `v-bind="args"` win, but keeps listeners, v-models, slots,
// `class` and `style` from both.
const KEPT_FROM_BOTH = /^(?:@|v-on:|v-model|#|v-slot|(?::|v-bind:)?(?:class|style)$)/;

const TAG_OPEN = /<([A-Za-z][^\s/>]*)/y;
const TAG_CLOSE = /<\/([^\s>]+)\s*>/y;
const TAG_END = /\s*\/?>/y;
const ATTRIBUTE = /(\s+)(([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?)/y;
const VOID_ELEMENT = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/;

interface Attribute {
  // Offset of the whitespace before the attribute.
  start: number;
  end: number;
  space: string;
  text: string;
  name: string;
  value?: string;
  quote: '"' | "'";
}

interface Element {
  kind: 'element';
  tag: string;
  start: number;
  attributes: Attribute[];
  // The tag's `>` or `/>`, with the whitespace before it.
  closer: string;
  end: number;
  children: Node[];
  close?: { start: number; end: number };
}

type Node =
  | Element
  | { kind: 'text'; text: string }
  | { kind: 'interpolation'; start: number; end: number; expression: string };

interface Edit {
  start: number;
  end: number;
  text: string;
}

// Fills a Vue story-docs template with the current args, keeping the story's structure:
// `v-if="args.loading"` reads `v-if="true"`. Every edit is computed against the template as
// written, so a filled-in value is never read as template again.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const scriptEnd = template.startsWith('<script') ? template.indexOf('</script>') : -1;
  const script = scriptEnd === -1 ? '' : template.slice(0, scriptEnd);
  return fillExpression(script, args, "'") + fillMarkup(template.slice(script.length), args);
};

// The snippet leaves out an unset arg, and an empty string as well; `null` it passes on.
const isUnset = (value: unknown) => value === undefined || value === '';

// Vue decodes entities in attribute values and interpolations.
const escapeAmpersands = (text: string) => text.replace(/&(?=[#\w])/g, '&amp;');

const escapeInAttribute = (printed: string, quote: '"' | "'") =>
  escapeAmpersands(printed).replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');

const escapeInInterpolation = (printed: string) =>
  escapeAmpersands(printed).replaceAll('}}', '}\\u007d');

// Fills every arg path in JavaScript code, printing strings with `quote`.
function fillExpression(
  code: string,
  args: Args,
  quote: '"' | "'",
  escape: (printed: string) => string = (printed) => printed
): string {
  return code.replace(ARG_PATH, (path: string, offset: number) => {
    const before = code.slice(0, offset);
    const { value, rest } = resolveArgPath(path, args);
    // A v-model's `ref(args.value)` with the arg unset reads `ref()`, as the snippet writes it.
    const isRefArgument =
      /(?<![\w$.])ref\(\s*$/.test(before) && /^\s*\)/.test(code.slice(offset + path.length));
    if (isRefArgument && value === undefined && rest === '') {
      return '';
    }
    const printed = escape(printArgPath(path, args, { ...PRINT_OPTIONS, quote }));
    // An object literal right after `=>` would read as a block.
    return printed.startsWith('{') && /=>\s*$/.test(before) ? `(${printed})` : printed;
  });
}

function fillMarkup(code: string, args: Args): string {
  const edits: Edit[] = [];
  fillNodes(parseMarkup(code), code, args, edits);
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (filled, edit) => filled.slice(0, edit.start) + edit.text + filled.slice(edit.end),
      code
    );
}

// Whether the nodes fill in to nothing but whitespace.
function fillNodes(nodes: Node[], code: string, args: Args, edits: Edit[]): boolean {
  let empty = true;
  for (const node of nodes) {
    if (node.kind === 'text') {
      empty &&= node.text.trim() === '';
    } else if (node.kind === 'interpolation') {
      const edit = interpolationEdit(node, code, args);
      edits.push(edit);
      empty &&= edit.text === '';
    } else {
      const childEdits: Edit[] = [];
      const emptied =
        fillNodes(node.children, code, args, childEdits) &&
        node.children.some(({ kind }) => kind === 'interpolation');
      // A slot whose args all fill in empty is left out, as the snippet leaves out an unset slot.
      if (emptied && node.close && isSlotTemplate(node)) {
        edits.push(removal(code, node.start, node.close.end));
        continue;
      }
      fillElement(node, code, args, edits);
      edits.push(...childEdits);
      empty = false;
    }
  }
  return empty;
}

function interpolationEdit(
  node: Extract<Node, { kind: 'interpolation' }>,
  code: string,
  args: Args
): Edit {
  const text = fillInterpolation(node.expression, args);
  if (text === '') {
    return removal(code, node.start, node.end);
  }
  // A `{` right before a `{{` would open the interpolation a brace early.
  const guarded = code.startsWith('{', node.end) ? text.replace(/\{$/, '&#123;') : text;
  return { start: node.start, end: node.end, text: guarded };
}

// Removes the code, with its line when nothing else is on it, so it leaves no blank line behind.
function removal(code: string, start: number, end: number): Edit {
  const lineStart = code.lastIndexOf('\n', start - 1);
  const lineEnd = code.slice(end).search(/\n|$/) + end;
  const isAlone =
    lineStart !== -1 &&
    code.slice(lineStart, start).trim() === '' &&
    code.slice(end, lineEnd).trim() === '';
  return isAlone ? { start: lineStart, end: lineEnd, text: '' } : { start, end, text: '' };
}

function fillInterpolation(expression: string, args: Args): string {
  const path = WHOLE_ARG_PATH.exec(expression)?.[1];
  if (path !== undefined) {
    const { value, rest } = resolveArgPath(path, args);
    const text = rest === '' ? toText(value) : undefined;
    if (text !== undefined) {
      return text;
    }
  }
  const filled = fillExpression(expression, args, "'", escapeInInterpolation);
  return `{{${filled.startsWith('{') ? ' ' : ''}${filled}${filled.endsWith('}') ? ' ' : ''}}}`;
}

// An arg as the content Vue renders for it, or `undefined` when only an expression shows it.
function toText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isVNode(value)) {
    return printMarkup(value);
  }
  // Vue condenses the whitespace around text, so padded text stays an expression.
  return typeof value === 'string' && !/^\s|\s$/.test(value) ? escapeTextContent(value) : undefined;
}

function fillElement(element: Element, code: string, args: Args, edits: Edit[]) {
  const { attributes } = element;
  const spreadSlots = attributes.map(({ name, value }) =>
    name === 'v-bind' && value !== undefined ? readArgsSpread(value) : undefined
  );
  const spreadIndex = spreadSlots.findIndex((slots) => slots !== undefined);
  const slots = spreadSlots[spreadIndex] ?? [];
  const written = spreadIndex === -1 ? new Set<string>() : writtenArgs(element, spreadIndex);
  const spread = spreadIndex === -1 ? [] : spreadAttributes(args, new Set([...written, ...slots]));
  const spreadNames = new Set(spread.map(([name]) => name));

  for (const attribute of spreadIndex === -1 ? attributes : attributes.slice(0, spreadIndex)) {
    const overridden =
      !KEPT_FROM_BOTH.test(attribute.name) &&
      argsOfAttribute(attribute.name).some((name) => spreadNames.has(name));
    const filled = overridden ? undefined : fillAttribute(attribute, args);
    if (filled !== attribute.text) {
      edits.push({ ...attribute, text: filled === undefined ? '' : attribute.space + filled });
    }
  }
  if (spreadIndex === -1) {
    return;
  }

  const indent = /^[ \t]*/.exec(code.slice(code.lastIndexOf('\n', element.start - 1) + 1))![0];
  const slotContent = slots
    .filter((slot) => !written.has(slot))
    .map((slot) => slotLines(slot, args[slot], `${indent}  `))
    .join('');
  const opens = slotContent !== '' && element.closer.includes('/');
  const closer = opens ? element.closer.replace(/ *\/>$/, '>') : element.closer;

  const [first, ...after] = attributes.slice(spreadIndex);
  const following = after.flatMap((attribute) => {
    const filled = fillAttribute(attribute, args);
    return filled === undefined ? [] : [{ space: attribute.space, text: filled }];
  });
  // A tag written one attribute per line stays that way; otherwise short lists stay on one line.
  const text =
    [first, ...after].some(({ space }) => space.includes('\n')) || closer.includes('\n')
      ? [
          ...spread.map(([, attribute]) => first.space + attribute),
          ...following.map(({ space, text: attribute }) => space + attribute),
          closer,
        ].join('')
      : layoutAttributes(
          [
            ...spread.map(([, attribute]) => attribute),
            ...following.map(({ text: attribute }) => attribute),
          ],
          code,
          element.start,
          closer
        );
  edits.push({
    start: first.start,
    end: element.end,
    text: opens ? `${text}${slotContent}\n${indent}</${element.tag}>` : text,
  });
  if (slotContent !== '' && !opens && element.close) {
    const contentEnd = code.slice(0, element.close.start).trimEnd().length;
    edits.push({ start: contentEnd, end: contentEnd, text: slotContent });
  }
}

// A slot arg as the snippet writes it in the element, on lines of their own, or `''` when unset.
function slotLines(slot: string, value: unknown, indent: string): string {
  const content = isUnset(value)
    ? ''
    : (toText(value) ??
      `{{ ${escapeInInterpolation(printValue(value, { ...PRINT_OPTIONS, quote: "'", name: slot }))} }}`);
  if (content === '') {
    return '';
  }
  const child = slot === 'default' ? content : `<template #${slot}>\n  ${content}\n</template>`;
  return `\n${indent}${child.replaceAll('\n', `\n${indent}`)}`;
}

// The attribute filled with the args, or `undefined` when an unset arg leaves it out.
function fillAttribute({ name, value, quote, text }: Attribute, args: Args): string | undefined {
  if (value === undefined || !DIRECTIVE.test(name)) {
    return text;
  }
  const path = WHOLE_ARG_PATH.exec(value)?.[1];
  if (path !== undefined && BINDING.test(name)) {
    const { value: argValue, rest, key } = resolveArgPath(path, args);
    if (rest === '') {
      return fillBinding(name, argValue, key);
    }
  }
  const strings = quote === '"' ? "'" : '"';
  const filled = fillExpression(value, args, strings, (printed) =>
    escapeInAttribute(printed, quote)
  );
  return `${name}=${quote}${filled}${quote}`;
}

// `:label="args.label"` reads `label="Hi"`, and `@click="args.onClick"` reads `@click="onClick"`.
function fillBinding(name: string, value: unknown, key: string): string | undefined {
  const prop = /^(?::|v-bind:)(.+)$/.exec(name)?.[1];
  if (prop !== undefined) {
    return toAttribute(prop, value);
  }
  return isUnset(value) ? undefined : `${name}="${printInAttribute(value, key)}"`;
}

// The args a `v-bind="args"` spreads, by name, as attributes: props sorted by name, then listeners.
function spreadAttributes(args: Args, written: ReadonlySet<string>): [string, string][] {
  const props: [string, string][] = [];
  const listeners: [string, string][] = [];
  const invalid: [string, unknown][] = [];
  for (const name of Object.keys(args).sort((a, b) => a.localeCompare(b))) {
    const value = args[name];
    const attribute = toAttribute(name, value);
    if (written.has(name) || attribute === undefined) {
      continue;
    }
    if (typeof value === 'function') {
      // Other functions are slots or function props, which the template writes out itself.
      if (/^on[A-Z]/.test(name)) {
        const event = name.charAt(2).toLowerCase() + name.slice(3);
        listeners.push([name, `@${event}="${printInAttribute(value, name)}"`]);
      }
    } else if (/^[A-Za-z_][\w:-]*$/.test(name)) {
      props.push([name, attribute]);
    } else {
      invalid.push([name, value]);
    }
  }
  if (invalid.length > 0) {
    const printed = escapeInAttribute(
      printValue(Object.fromEntries(invalid), { ...PRINT_OPTIONS, quote: "'" }),
      '"'
    );
    props.push(['', `v-bind="${printed}"`]);
  }
  return [...props, ...listeners];
}

// A Vue attribute for an arg, or `undefined` when an unset arg leaves it out.
function toAttribute(name: string, value: unknown): string | undefined {
  if (isUnset(value)) {
    return undefined;
  }
  if (value === true) {
    return name;
  }
  if (typeof value === 'string' && !value.includes('\n')) {
    const text = escapeAmpersands(value);
    if (!value.includes('"')) {
      return `${name}="${text}"`;
    }
    if (!value.includes("'")) {
      return `${name}='${text}'`;
    }
  }
  return `:${name}="${printInAttribute(value, name)}"`;
}

const printInAttribute = (value: unknown, name: string) =>
  escapeInAttribute(printValue(value, { ...PRINT_OPTIONS, quote: "'", name }), '"');

const PRINT_OPTIONS: PrintValueOptions = {
  printCustom: (value, options) => {
    if (isVNode(value)) {
      return printH(value, { ...options, name: undefined });
    }
    return isComponent(value) ? componentName(value) : undefined;
  },
};

// A VNode as the `h()` call that creates it.
function printH({ type, props, children }: VNode, options: PrintValueOptions): string {
  const printed = [typeof type === 'string' ? printValue(type, options) : componentName(type)];
  if (typeof children === 'string' || Array.isArray(children)) {
    printed.push(printValue(props, options), printValue(children, options));
  } else if (props) {
    printed.push(printValue(props, options));
  }
  return `h(${printed.join(', ')})`;
}

// A VNode as the markup that renders it, the way the snippet prints an `h()` slot.
function printMarkup({ type, props, children }: VNode): string {
  if (type === Comment) {
    return '';
  }
  const content = (
    typeof children === 'string' ? [children] : Array.isArray(children) ? children : []
  )
    .map((child) => (typeof child === 'string' ? escapeTextContent(child) : (toText(child) ?? '')))
    .join('');
  if (typeof type === 'symbol') {
    return content;
  }
  const tag = typeof type === 'string' ? type : componentName(type);
  const attributes = spreadAttributes(props ?? {}, new Set())
    .map(([, attribute]) => ` ${attribute}`)
    .join('');
  return content === '' ? `<${tag}${attributes} />` : `<${tag}${attributes}>${content}</${tag}>`;
}

const isComponent = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  ['setup', 'render', '__name'].some((key) => key in value);

function componentName(component: unknown): string {
  const { name, __name } = component as { name?: string; __name?: string };
  return name || __name || 'Component';
}

// The args the element passes on its own, so the spread leaves them out: attributes written after
// it, listeners, v-models and slots, and slot content.
function writtenArgs({ attributes, children }: Element, spreadIndex: number): Set<string> {
  const names = new Set<string>();
  attributes.forEach(({ name }, index) => {
    if (index > spreadIndex || KEPT_FROM_BOTH.test(name)) {
      argsOfAttribute(name).forEach((arg) => names.add(arg));
    }
  });
  for (const child of children) {
    if (child.kind === 'text' && child.text.trim() === '') {
      continue;
    }
    const slot =
      child.kind === 'element' && child.tag === 'template'
        ? child.attributes.map(({ name }) => slotName(name)).find((found) => found !== undefined)
        : undefined;
    names.add(slot ?? 'default');
  }
  return names;
}

function argsOfAttribute(attribute: string): string[] {
  const [name] = attribute.split('.');
  const model = /^v-model(?::(.+))?$/.exec(name);
  if (model) {
    const prop = camelize(model[1] ?? 'modelValue');
    return [prop, `onUpdate:${prop}`];
  }
  const listener = /^(?:@|v-on:)(.+)$/.exec(name);
  if (listener) {
    const event = camelize(listener[1]);
    return [`on${event.charAt(0).toUpperCase()}${event.slice(1)}`];
  }
  const slot = slotName(name);
  if (slot !== undefined) {
    return [slot];
  }
  const prop = /^(?::|v-bind:)(.+)$/.exec(name)?.[1] ?? (name.startsWith('v-') ? undefined : name);
  return prop === undefined ? [] : [prop, camelize(prop)];
}

// `#header`, `v-slot:header`, and a bare `v-slot` for the default slot
function slotName(attribute: string): string | undefined {
  const slot = /^(?:#|v-slot:?)(.*)$/.exec(attribute);
  return slot ? slot[1] || 'default' : undefined;
}

const isSlotTemplate = ({ tag, attributes }: Element) =>
  tag === 'template' && attributes.some(({ name }) => slotName(name) !== undefined);

function parseMarkup(code: string): Node[] {
  const root: Node[] = [];
  const open: Pick<Element, 'tag' | 'children' | 'close'>[] = [{ tag: '', children: root }];
  let index = 0;
  while (index < code.length) {
    const { children } = open.at(-1)!;
    if (code.startsWith('<!--', index)) {
      const end = code.indexOf('-->', index);
      index = end === -1 ? code.length : end + 3;
      continue;
    }
    const interpolationEnd = code.startsWith('{{', index) ? code.indexOf('}}', index + 2) : -1;
    if (interpolationEnd !== -1) {
      const expression = code.slice(index + 2, interpolationEnd);
      children.push({ kind: 'interpolation', start: index, end: interpolationEnd + 2, expression });
      index = interpolationEnd + 2;
      continue;
    }
    TAG_CLOSE.lastIndex = index;
    const close = TAG_CLOSE.exec(code);
    if (close) {
      const depth = open.findLastIndex(({ tag }) => tag === close[1]);
      if (depth > 0) {
        open[depth].close = { start: index, end: TAG_CLOSE.lastIndex };
        open.length = depth;
      }
      index = TAG_CLOSE.lastIndex;
      continue;
    }
    const element = readOpenTag(code, index);
    if (element) {
      children.push(element);
      if (!element.closer.includes('/') && !VOID_ELEMENT.test(element.tag)) {
        open.push(element);
      }
      index = element.end;
      continue;
    }
    const next = [code.indexOf('<', index + 1), code.indexOf('{{', index + 1)].filter(
      (at) => at !== -1
    );
    const end = next.length > 0 ? Math.min(...next) : code.length;
    children.push({ kind: 'text', text: code.slice(index, end) });
    index = end;
  }
  return root;
}

function readOpenTag(code: string, start: number): Element | undefined {
  TAG_OPEN.lastIndex = start;
  const tag = TAG_OPEN.exec(code);
  if (!tag) {
    return undefined;
  }
  const attributes: Attribute[] = [];
  let index = TAG_OPEN.lastIndex;
  for (;;) {
    TAG_END.lastIndex = index;
    const closer = TAG_END.exec(code)?.[0];
    if (closer !== undefined) {
      const end = TAG_END.lastIndex;
      return { kind: 'element', tag: tag[1], start, attributes, closer, end, children: [] };
    }
    ATTRIBUTE.lastIndex = index;
    const attribute = ATTRIBUTE.exec(code);
    if (!attribute) {
      return undefined;
    }
    const [, space, text, name, double, single, bare] = attribute;
    index = ATTRIBUTE.lastIndex;
    attributes.push({
      start: attribute.index,
      end: index,
      space,
      text,
      name,
      value: double ?? single ?? bare,
      quote: single === undefined ? '"' : "'",
    });
  }
}
