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

export interface BuildTemplateInput {
  inputs: TemplateInputBinding[];
  // Output binding names; each renders as `(name)="name($event)"`.
  outputs: string[];
  innerTemplate?: string;
  // On, a dashed element drops its closing tag, and any tag that ends itself puts `/>` on its own
  // line once it breaks -- void elements included. Off reproduces the legacy runtime generator's
  // output, which is what the preview renderer emits.
  selfClosing?: boolean;
}

// A selector that names no element, `.card` or `[appHighlight]`, matches a `div` in the snippet.
const LEADING_CLASS = /^\..+/;
const LEADING_ATTRIBUTE = /^\[.+?]/;

const ID = /#([\w-]+)/;
// One run of adjacent classes, `.a.b`, becomes a single class attribute.
const CLASS_RUN = /(\.[\w-]+)+/;
const ATTRIBUTE = /\[(.+?)]/g;
// The leading non-space run is the element name; whatever follows are its attributes.
const ELEMENT_AND_ATTRIBUTES = /(\S+)(.*)/;

// Width past which the bindings go one per line, with the tag's end on a line of its own.
const MAX_SINGLE_LINE = 80;

// Expands a component selector into the element a story renders, carrying its bindings.
export const buildTemplate = (
  selector: string,
  { inputs, outputs, innerTemplate = '', selfClosing = false }: BuildTemplateInput
) => {
  const bindings = [
    ...inputs.map(({ name, expression }) => `[${name}]="${expression}"`),
    ...outputs.map((name) => `(${name})="${formatPropInTemplate(name)}($event)"`),
  ];

  const firstSelector = selector.split(',')[0];
  const withElement =
    LEADING_CLASS.test(firstSelector) || LEADING_ATTRIBUTE.test(firstSelector)
      ? `div${firstSelector}`
      : firstSelector;

  const asAttributes = withElement
    .replace(ID, ' id="$1"')
    .replace(CLASS_RUN, (classes) => ` class="${classes.split('.').join(' ').trim()}"`)
    .replace(ATTRIBUTE, ' $1');

  return asAttributes.replace(ELEMENT_AND_ATTRIBUTES, (_, element: string, attributes: string) => {
    // HTML reserves a dashed name for custom elements, so Angular can never reject one self-closed.
    const closesItself =
      VOID_ELEMENTS.has(element) || (selfClosing && element.includes('-') && innerTemplate === '');

    const inlineTag = `<${element}${attributes}${bindings.map((binding) => ` ${binding}`).join('')}`;
    const inline = closesItself ? `${inlineTag} />` : `${inlineTag}>${innerTemplate}</${element}>`;
    if (inline.length <= MAX_SINGLE_LINE || bindings.length === 0) {
      return inline;
    }

    const brokenTag = `<${element}${attributes}\n${bindings.map((binding) => `    ${binding}`).join('\n')}`;
    if (closesItself) {
      // The bracket takes the line the closing tag would have had, rather than trailing a binding.
      return selfClosing ? `${brokenTag}\n/>` : `${brokenTag} />`;
    }
    const content = innerTemplate === '' ? '\n' : `\n${innerTemplate}\n`;
    return `${brokenTag}>${content}</${element}>`;
  });
};

// Fallback element for a component whose decorator declares no selector.
export const buildComponentOutletTemplate = (
  componentName: string,
  { selfClosing = false }: { selfClosing?: boolean } = {}
): string =>
  selfClosing
    ? `<ng-container *ngComponentOutlet="${componentName}" />`
    : `<ng-container *ngComponentOutlet="${componentName}"></ng-container>`;

const INDENT = '    ';

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

const openTagLines = (node: MarkupElement, pad: string, forceAttrBreak: boolean): string[] => {
  const inlineOpen = `${pad}${node.rawOpen}`;
  const attrs = node.attrText.match(MARKUP_ATTRIBUTE) ?? [];
  if ((inlineOpen.length <= MAX_SINGLE_LINE && !forceAttrBreak) || attrs.length === 0) {
    return [inlineOpen];
  }
  const bracket = node.closed ? ' />' : '>';
  return [
    `${pad}<${node.tag}`,
    ...attrs.map(
      (attr, index) => `${pad}${INDENT}${attr}${index === attrs.length - 1 ? bracket : ''}`
    ),
  ];
};

const printMarkup = (markup: string, node: MarkupElement | string, depth: number): string[] => {
  const pad = INDENT.repeat(depth);
  if (typeof node === 'string') {
    return [`${pad}${node}`];
  }
  const hasElementChild = node.children.some((child) => typeof child !== 'string');
  const verbatim = markup.slice(node.start, node.end);
  if (!hasElementChild && pad.length + verbatim.length <= MAX_SINGLE_LINE) {
    return [`${pad}${verbatim}`];
  }
  // A childless element broke on length alone, so keeping its attribute run inline gains nothing.
  const openLines = openTagLines(node, pad, !hasElementChild);
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
 * onto their own lines and an over-long attribute run breaks one binding per line. Nothing is
 * added, dropped or reordered, and markup this cannot follow is returned exactly as written.
 */
export const formatTemplateMarkup = (markup: string): string => {
  const children = parseMarkup(markup);
  if (!children || children.length === 0) {
    return markup;
  }
  return children.flatMap((child) => printMarkup(markup, child, 0)).join('\n');
};
