export interface ElementSnippet {
  tag: string;
  attributes: { name: string; value: unknown }[];
  cssProperties: { name: string; value: unknown }[];
  slots: { name: string; html: string }[];
  styleRules: { selector: string; declarations: string }[];
}

export function printElementSnippet(snippet: ElementSnippet): string {
  const style = printStyle(snippet.styleRules);
  const open = printOpeningTag(snippet);
  const slots = snippet.slots.map(printSlot);
  const element =
    slots.length === 0
      ? `${open}></${snippet.tag}>`
      : `${open}>\n${slots.map((slot) => `  ${slot}`).join('\n')}\n</${snippet.tag}>`;

  return style ? `${style}\n${element}` : element;
}

const printStyle = (rules: ElementSnippet['styleRules']): string | undefined =>
  rules.length === 0
    ? undefined
    : `<style>\n${rules
        .map(({ selector, declarations }) => `  ${selector} { ${declarations} }`)
        .join('\n')}\n</style>`;

const printOpeningTag = (snippet: ElementSnippet): string => {
  const attributes = snippet.attributes.flatMap(printAttribute);
  const style = printCssProperties(snippet.cssProperties);
  return [`<${snippet.tag}`, ...attributes, ...(style ? [style] : [])].join(' ');
};

const printAttribute = ({ name, value }: { name: string; value: unknown }): string[] => {
  if (value === true) {
    return [name];
  }
  if (value === false || value === null || value === undefined || value === '') {
    return [];
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return [`${name}="${escapeAttribute(text)}"`];
};

const printCssProperties = (properties: ElementSnippet['cssProperties']): string | undefined => {
  const declarations = properties
    .filter(({ value }) => value !== null && value !== undefined)
    .map(({ name, value }) => `${name}: ${String(value)};`);
  return declarations.length === 0
    ? undefined
    : `style="${escapeAttribute(declarations.join(' '))}"`;
};

const printSlot = ({ name, html }: ElementSnippet['slots'][number]): string => {
  if (name === 'default') {
    return html;
  }
  const injected = injectSlotAttribute(html, name);
  return injected ?? `<span slot="${escapeAttribute(name)}">${html}</span>`;
};

const injectSlotAttribute = (html: string, name: string): string | undefined => {
  const trimmed = html.trim();
  const opening = readOpeningTag(trimmed, 0);
  if (!opening || opening.selfClosing) {
    return undefined;
  }

  let depth = 1;
  let index = opening.end;
  while (index < trimmed.length) {
    const closingEnd = readClosingTagEnd(trimmed, index, opening.name);
    if (closingEnd !== undefined) {
      depth -= 1;
      if (depth === 0) {
        return closingEnd === trimmed.length
          ? `${trimmed.slice(0, opening.end - 1)} slot="${escapeAttribute(name)}"${trimmed.slice(
              opening.end - 1
            )}`
          : undefined;
      }
      index = closingEnd;
      continue;
    }

    const nested = readOpeningTag(trimmed, index, opening.name);
    if (nested) {
      if (!nested.selfClosing) {
        depth += 1;
      }
      index = nested.end;
      continue;
    }
    index += 1;
  }

  return undefined;
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const readOpeningTag = (
  html: string,
  start: number,
  expectedName?: string
): { name: string; end: number; selfClosing: boolean } | undefined => {
  if (html[start] !== '<' || html[start + 1] === '/') {
    return undefined;
  }
  const nameMatch = /^[a-zA-Z][\w:-]*/.exec(html.slice(start + 1));
  if (!nameMatch) {
    return undefined;
  }
  const name = nameMatch[0];
  const boundary = html[start + 1 + name.length];
  if (expectedName !== undefined && name !== expectedName) {
    return undefined;
  }
  if (boundary !== undefined && !/[\s/>]/.test(boundary)) {
    return undefined;
  }
  const end = findTagEnd(html, start);
  if (end === undefined) {
    return undefined;
  }
  let beforeEnd = end - 2;
  while (beforeEnd > start && /\s/.test(html[beforeEnd])) {
    beforeEnd -= 1;
  }
  return { name, end, selfClosing: html[beforeEnd] === '/' };
};

const readClosingTagEnd = (html: string, start: number, name: string): number | undefined => {
  if (!html.startsWith(`</${name}`, start)) {
    return undefined;
  }
  const boundary = html[start + name.length + 2];
  if (boundary !== undefined && !/[\s>]/.test(boundary)) {
    return undefined;
  }
  return findTagEnd(html, start);
};

const findTagEnd = (html: string, start: number): number | undefined => {
  let quote: '"' | "'" | undefined;
  for (let index = start + 1; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return index + 1;
    }
  }
  return undefined;
};
