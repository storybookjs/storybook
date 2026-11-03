import { findTagEnd, parseHtml } from './html-parse.ts';

// How a story-docs snippet prints one arg value in html, for the story-docs build that prints the
// static snippet and for the preview filler that prints a value a control changed, so both print a
// value alike. Layout is the build's alone.

export function escapeAttribute(value: string, quote: '"' | "'" = '"'): string {
  const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return quote === "'" ? escaped.replace(/'/g, '&#39;') : escaped.replace(/"/g, '&quot;');
}

export const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** An attribute with `text` as its value, in double quotes. */
export const quotedAttribute = (name: string, text: string): string =>
  `${name}="${escapeAttribute(text)}"`;

/**
 * What an attribute Storybook's render sets to `value` holds: `undefined` while it is left out,
 * `true` while it is the name alone, else its text. An empty value is left out unless a field
 * reflects it.
 */
export function attributeText(value: unknown, viaField?: boolean): string | true | undefined {
  if (value === true) {
    return true;
  }
  if (value === '') {
    return viaField ? '' : undefined;
  }
  if (value === false || value === null || value === undefined) {
    return undefined;
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** The attribute Storybook's render sets to `value`, or `undefined` while it is left out. */
export function printAttribute(
  name: string,
  value: unknown,
  viaField?: boolean
): string | undefined {
  const text = attributeText(value, viaField);
  return text === undefined ? undefined : text === true ? name : quotedAttribute(name, text);
}

/** The text of a value a lit template binds in an attribute value: none while it is unset. */
export const boundText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

/** The `style` declarations of the custom properties that are set, or `undefined` for none. */
export const cssDeclarations = (
  properties: { name: string; value: unknown }[]
): string | undefined => {
  const declarations = properties
    .filter(({ value }) => value !== null && value !== undefined && value !== '')
    .map(({ name, value }) => `${name}: ${String(value)};`);
  return declarations.length === 0 ? undefined : declarations.join(' ');
};

/** Whether lit's `?name=${value}` sets the attribute. */
export const isTruthy = (value: unknown): boolean => Boolean(value);

/** Whether lit's `ifDefined(value)` sets the attribute. */
export const isDefined = (value: unknown): boolean => value !== null && value !== undefined;

/** The `<style>` of part and state rules. */
export const styleElement = (rules: { selector: string; declarations: string }[]): string =>
  `<style>${styleText(rules)}</style>`;

/** The text of a `<style>` of part and state rules. */
export const styleText = (rules: { selector: string; declarations: string }[]): string =>
  `\n${rules.map(({ selector, declarations }) => `  ${selector} { ${declarations} }`).join('\n')}\n`;

/** The text or html a value a template renders as content prints: an array its items joined. */
export const childText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : Array.isArray(value)
      ? value.map((item) => item ?? '').join('')
      : String(value);

/** The html a slot arg holds: none while it is unset or empty. */
export const slotText = (value: unknown): string =>
  value === null || value === undefined || value === '' ? '' : String(value);

/** Text with its whitespace collapsed as a text node prints, trimmed at its `first` and `last` end. */
export const inlineText = (text: string, first: boolean, last: boolean): string => {
  let collapsed = text.replace(/\s+/g, ' ');
  if (first) {
    collapsed = collapsed.trimStart();
  }
  if (last) {
    collapsed = collapsed.trimEnd();
  }
  return collapsed;
};

/**
 * How the html of a named slot takes its `slot` attribute: on its one element, or on a `<span>`
 * around it. The default slot, and a slot with no html, takes none.
 */
export function slotPlacement(name: string, html: string): 'none' | 'element' | 'span' {
  if (name === 'default' || html === '') {
    return 'none';
  }
  const nodes = parseHtml(html);
  const [only] = nodes;
  return nodes.length === 1 &&
    only?.kind === 'element' &&
    !only.selfClosing &&
    !only.attributes.some((attribute) => attribute.name === 'slot')
    ? 'element'
    : 'span';
}

/** The html of a slot with its `slot` attribute, which its one element takes after its others. */
export function slottedHtml(name: string, html: string): string {
  switch (slotPlacement(name, html)) {
    case 'none':
      return html;
    case 'element': {
      // The one element opens the html, so its start tag ends before the first `>` it reads.
      const end = findTagEnd(html, 0)! - 1;
      return `${html.slice(0, end)} ${quotedAttribute('slot', name)}${html.slice(end)}`;
    }
    case 'span':
      return `<span ${quotedAttribute('slot', name)}>${html}</span>`;
  }
}
