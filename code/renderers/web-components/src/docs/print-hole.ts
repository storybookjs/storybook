import {
  type PrintHole,
  UnprintableArgError,
  printValue,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';

import {
  cssDeclarations,
  escapeAttribute,
  printAttribute,
  quotedAttribute,
  slotText,
  slottedHtml,
  styleElement,
  styleRule,
} from '../snippet-values.ts';
import type { HtmlHolePlace, SnippetProperty } from '../snippet-holes.ts';

// Prints a changed arg for a hole of a template from `build-story-docs.ts`, with the printer the
// static snippet prints a value in that place with; see `HtmlHolePlace`.
export const printHole: PrintHole<HtmlHolePlace> = (hole, changed) => {
  const arg = hole.arg ?? '';
  const value = printable(arg, changed);
  switch (hole.kind) {
    case 'attr':
      return printAttribute(hole.name ?? arg, value, hole.mode === 'field') ?? '';
    case 'code':
      return printValue(value, arg, { quote: "'", opaque: isLitValue });
    case 'css':
      return escapeAttribute(cssDeclarations([{ name: hole.property ?? arg, value }]) ?? '');
    case 'cssattr': {
      const args = changed as Record<string, unknown>;
      const style = cssDeclarations(
        hole.properties
          .filter((property) => Object.hasOwn(args, property.arg))
          .map((property) => ({
            name: property.property,
            value: printable(property.arg, args[property.arg]),
          }))
      );
      return style === undefined ? '' : quotedAttribute('style', style);
    }
    case 'slot':
      return slottedHtml(hole.name, slotText(value));
    case 'rule':
      return isSet(value) ? styleRule(hole.selector, String(value)) : '';
    case 'style':
      return isSet(value)
        ? `${styleElement([{ selector: hole.selector, declarations: String(value) }])}\n`
        : '';
    case 'props':
      return propertyScript(hole.properties, changed as Record<string, unknown>);
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      return unknownHoleKind(hole);
  }
};

// The `<script>` that sets each property a control set, as the story sets it: on the element it
// queries, to the value as JavaScript.
const propertyScript = (properties: SnippetProperty[], args: Record<string, unknown>): string => {
  const lines = properties.flatMap(({ arg, name, tag }) => {
    const value = Object.hasOwn(args, arg) ? args[arg] : undefined;
    if (value === undefined) {
      return [];
    }
    // `<\/` and `<\!--` read as `</` and `<!--`, which would end or break the script.
    const code = printValue(value, arg, { quote: "'", opaque: isLitValue }).replace(
      /<(\/|!--)/g,
      '<\\$1'
    );
    const property = /^[A-Za-z_$][\w$]*$/.test(name)
      ? `.${name}`
      : `[${printValue(name, name, { quote: "'" })}]`;
    return [`  document.querySelector('${tag}')${property} = ${code};`];
  });
  return lines.length === 0 ? '' : `<script>\n${lines.join('\n')}\n</script>`;
};

const isSet = (value: unknown) => value !== null && value !== undefined && value !== '';

// A function, or a lit template or directive, has no html the snippet could show.
function printable(arg: string, value: unknown): unknown {
  if (typeof value === 'function' || typeof value === 'symbol' || isLitValue(value)) {
    throw new UnprintableArgError(arg);
  }
  return value;
}

const isLitValue = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).some((key) => key.includes('$lit'));
