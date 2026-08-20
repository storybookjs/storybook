// Imported by the preview renderer and by the dev-server story-docs provider, so this module must
// stay free of `@angular/core` and of any other runtime-only import.

export const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

export const formatPropInTemplate = (propertyName: string) =>
  isValidIdentifier(propertyName) ? propertyName : `this['${propertyName}']`;

const stringifyCircular = (obj: unknown) => {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
};

// A string is serialized by JSON first so control characters stay escaped, then its delimiters are
// converted: the expression sits in a double-quoted binding attribute, so it is single-quoted and a
// literal double quote survives only as its entity.
const singleQuoted = (text: string): string =>
  `'${JSON.stringify(text)
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')}'`;

const formatJsonValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return singleQuoted(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatJsonValue).join(', ')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${isValidIdentifier(key) ? key : singleQuoted(key)}: ${formatJsonValue(item)}`
    );
    return `{${entries.join(', ')}}`;
  }
  return String(value);
};

// Renders an arg value as the template expression an `[input]` binding is given.
export const formatInputValue = (value: unknown): string => {
  switch (typeof value) {
    case 'string':
      return singleQuoted(value);
    case 'object':
      // The JSON round-trip applies `toJSON`, drops unserializable members and caps cycles, so the
      // formatter only ever sees what the legacy generator serialized.
      return formatJsonValue(JSON.parse(stringifyCircular(value)));
    default:
      return `${value}`;
  }
};

// https://www.w3.org/TR/2011/WD-html-markup-20110113/syntax.html#syntax-elements
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export interface TemplateInputBinding {
  name: string;
  // The template expression the `[input]` binding is given, e.g. from `formatInputValue`.
  expression: string;
}

// The two shapes this module prints. `snippet` is the source Storybook shows a reader: a dashed
// element drops its closing tag, `/>` takes a line of its own once the tag breaks, and the tag
// breaks on its binding count. `legacy` is what the runtime generator has always emitted.
export type TemplateStyle = 'snippet' | 'legacy';

export interface BuildTemplateInput {
  inputs: TemplateInputBinding[];
  // Output binding names; each renders as `(name)="name($event)"`.
  outputs: string[];
  innerTemplate?: string;
  style: TemplateStyle;
}

type TagClose =
  | { selfClosing: true; tag?: never; inner?: never }
  | { selfClosing: false; tag: string; inner: string };

interface LayoutTagInput {
  open: string;
  bindings: string[];
  close: TagClose;
  style: TemplateStyle;
}

const layoutTag = ({ open, bindings, close, style }: LayoutTagInput): string => {
  const inlineOpen = `${open}${bindings.map((binding) => ` ${binding}`).join('')}`;
  const inline = close.selfClosing
    ? `${inlineOpen} />`
    : `${inlineOpen}>${close.inner}</${close.tag}>`;
  const breaks =
    bindings.length > 0 &&
    (style === 'legacy' ? inline.length > MAX_SINGLE_LINE : bindings.length >= BREAK_AT_BINDINGS);

  if (!breaks) {
    return inline;
  }

  const broken = `${open}\n${bindings.map((binding) => `${INDENT}${binding}`).join('\n')}`;
  if (close.selfClosing) {
    return style === 'legacy' ? `${broken} />` : `${broken}\n/>`;
  }
  return `${broken}>${close.inner === '' ? '\n' : `\n${close.inner}\n`}</${close.tag}>`;
};

// A selector that names no element, `.card` or `[appHighlight]`, matches a `div` in the snippet.
const LEADING_CLASS = /^\..+/;
const LEADING_ATTRIBUTE = /^\[.+?]/;

const ID = /#([\w-]+)/;
// One run of adjacent classes, `.a.b`, becomes a single class attribute.
const CLASS_RUN = /(\.[\w-]+)+/;
const ATTRIBUTE = /\[(.+?)]/g;
// The leading non-space run is the element name; whatever follows are its attributes.
const ELEMENT_AND_ATTRIBUTES = /(\S+)(.*)/;

// Binding count from which a snippet goes one binding per line, with the tag's end on a line of its
// own. Counting bindings instead of measuring the rendered tag keeps the layout independent of the
// values, so a snippet does not change shape while a reader types into a Controls knob.
const BREAK_AT_BINDINGS = 3;

// Width past which the legacy shape breaks, and what story-authored markup falls back to.
const MAX_SINGLE_LINE = 80;

// One level of indentation, which is also what a broken tag indents its bindings by.
const INDENT = '    ';

const renderBindings = (inputs: TemplateInputBinding[], outputs: readonly string[]): string[] => [
  ...inputs.map(({ name, expression }) => `[${name}]="${expression}"`),
  ...outputs.map((name) => `(${name})="${formatPropInTemplate(name)}($event)"`),
];

// Expands a component selector into the element a story renders, and the attributes it carries.
const expandSelector = (selector: string): { element: string; attributes: string } => {
  const firstSelector = selector.split(',')[0];
  const withElement =
    LEADING_CLASS.test(firstSelector) || LEADING_ATTRIBUTE.test(firstSelector)
      ? `div${firstSelector}`
      : firstSelector;

  const asAttributes = withElement
    .replace(ID, ' id="$1"')
    .replace(CLASS_RUN, (classes) => ` class="${classes.split('.').join(' ').trim()}"`)
    .replace(ATTRIBUTE, ' $1');

  const [, element, attributes] = ELEMENT_AND_ATTRIBUTES.exec(asAttributes)!;
  return { element, attributes };
};

/** Expands a component selector into the element a story renders, carrying its bindings. */
export const buildTemplate = (
  selector: string,
  { inputs, outputs, innerTemplate = '', style }: BuildTemplateInput
) => {
  const bindings = renderBindings(inputs, outputs);
  const { element, attributes } = expandSelector(selector);
  const legacy = style === 'legacy';
  // HTML reserves a dashed name for custom elements, so Angular can never reject one self-closed.
  const closesItself =
    VOID_ELEMENTS.has(element) || (!legacy && element.includes('-') && innerTemplate === '');

  const open = `<${element}${attributes}`;
  const close: TagClose = closesItself
    ? { selfClosing: true }
    : { selfClosing: false, tag: element, inner: innerTemplate };
  return layoutTag({ open, bindings, close, style });
};

// Fallback element for a component whose decorator declares no selector.
export const buildComponentOutletTemplate = (componentName: string, style: TemplateStyle): string =>
  style === 'legacy'
    ? `<ng-container *ngComponentOutlet="${componentName}"></ng-container>`
    : `<ng-container *ngComponentOutlet="${componentName}" />`;

interface MarkupElement {
  tag: string;
  /** The open tag exactly as written, closing bracket included. */
  rawOpen: string;
  attrText: string;
  /** Self-closing or void: the element brings its own end. */
  closed: boolean;
  start: number;
  end: number;
  children: (MarkupElement | string)[];
}

const MARKUP_TAG = /<(\/?)([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const parseMarkup = (markup: string): (MarkupElement | string)[] | undefined => {
  const root: MarkupElement = {
    tag: '',
    rawOpen: '',
    attrText: '',
    closed: false,
    start: 0,
    end: 0,
    children: [],
  };
  const stack = [root];
  let lastIndex = 0;
  for (const match of markup.matchAll(MARKUP_TAG)) {
    const text = markup.slice(lastIndex, match.index).trim();
    if (text) {
      stack.at(-1)!.children.push(text);
    }
    lastIndex = match.index + match[0].length;
    const [rawOpen, closing, tag, rawAttrText] = match;
    if (closing) {
      const open = stack.pop();
      if (!open || open.tag !== tag || stack.length === 0) {
        return undefined;
      }
      open.end = lastIndex;
      continue;
    }
    const selfClosing = rawAttrText.trimEnd().endsWith('/');
    const attrText = selfClosing ? rawAttrText.trimEnd().slice(0, -1) : rawAttrText;
    const element: MarkupElement = {
      tag,
      rawOpen,
      attrText: attrText.trimEnd(),
      closed: selfClosing || VOID_ELEMENTS.has(tag),
      start: match.index,
      end: lastIndex,
      children: [],
    };
    stack.at(-1)!.children.push(element);
    if (!element.closed) {
      stack.push(element);
    }
  }
  const trailing = markup.slice(lastIndex).trim();
  if (trailing) {
    stack.at(-1)!.children.push(trailing);
  }
  return stack.length === 1 ? root.children : undefined;
};

// An attribute name with an optional quoted or bare value; quoted values are skipped whole.
const MARKUP_ATTRIBUTE = /[^\s=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\S+))?/g;

const exceedsLineWidth = (inlineWidth: number): boolean => inlineWidth > MAX_SINGLE_LINE;

const openTagLines = (
  node: MarkupElement,
  pad: string,
  attrs: string[],
  forceAttrBreak: boolean
): string[] => {
  const inlineOpen = `${pad}${node.rawOpen}`;
  if (attrs.length === 0 || (!forceAttrBreak && !exceedsLineWidth(inlineOpen.length))) {
    return [inlineOpen];
  }
  const lines = [`${pad}<${node.tag}`, ...attrs.map((attr) => `${pad}${INDENT}${attr}`)];
  // The same end a generated tag gets: a self-closing bracket takes the line the closing tag would
  // have had, rather than trailing an attribute.
  if (node.closed) {
    return [...lines, `${pad}/>`];
  }
  return [...lines.slice(0, -1), `${lines.at(-1)}>`];
};

const printMarkup = (markup: string, node: MarkupElement | string, depth: number): string[] => {
  const pad = INDENT.repeat(depth);
  if (typeof node === 'string') {
    return [`${pad}${node}`];
  }
  const hasElementChild = node.children.some((child) => typeof child !== 'string');
  const attrs = node.attrText.match(MARKUP_ATTRIBUTE) ?? [];
  const verbatim = markup.slice(node.start, node.end);
  if (!hasElementChild && !exceedsLineWidth(pad.length + verbatim.length)) {
    return [`${pad}${verbatim}`];
  }
  // A childless element already decided to break, so keeping its attribute run inline gains nothing.
  const openLines = openTagLines(node, pad, attrs, !hasElementChild);
  if (node.closed) {
    return openLines;
  }
  return [
    ...openLines,
    ...node.children.flatMap((child) => printMarkup(markup, child, depth + 1)),
    `${pad}</${node.tag}>`,
  ];
};

/**
 * Reshape story-authored markup the way the generated templates are shaped: nested elements move
 * onto their own lines, and an element too wide to fit breaks one attribute per line. Nothing is
 * added, dropped or reordered, and markup this cannot follow is returned exactly as written.
 */
export const formatTemplateMarkup = (markup: string): string => {
  const children = parseMarkup(markup);
  if (!children || children.length === 0) {
    return markup;
  }
  return children.flatMap((child) => printMarkup(markup, child, 0)).join('\n');
};
