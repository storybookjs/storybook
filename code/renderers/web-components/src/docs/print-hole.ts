import {
  type PrintHole,
  UnprintableArgError,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';

import {
  boundText,
  childText,
  cssDeclarations,
  escapeAttribute,
  escapeText,
  inlineText,
  isDefined,
  isTruthy,
  printAttribute,
  quotedAttribute,
  slotText,
  slottedHtml,
  styleElement,
} from '../snippet-values.ts';
import type { HtmlHolePlace } from '../snippet-holes.ts';

// Prints a changed arg for a hole of a template from `build-story-docs.ts`, with the printer the
// static snippet prints a value in that place with; see `HtmlHolePlace`.
export const printHole: PrintHole<HtmlHolePlace> = (hole, changed) => {
  const arg = hole.arg ?? '';
  const value = printable(arg, changed);
  switch (hole.kind) {
    case 'attr': {
      const name = hole.name ?? arg;
      if (hole.mode === 'bind' || hole.mode === 'defined') {
        return hole.mode === 'defined' && !isDefined(value)
          ? ''
          : quotedAttribute(name, boundText(value));
      }
      return printAttribute(name, value, hole.mode === 'field') ?? '';
    }
    case 'bool':
      // Lit sets the attribute while the value is truthy, as the static snippet reads it.
      return isTruthy(value) ? (hole.name ?? arg) : '';
    case 'quoted':
      return escapeAttribute(boundText(value));
    case 'css':
      return escapeAttribute(cssDeclarations([{ name: hole.property ?? arg, value }]) ?? '');
    case 'cssattr': {
      const style = cssDeclarations([{ name: hole.property ?? arg, value }]);
      return style === undefined ? '' : quotedAttribute('style', style);
    }
    case 'text':
      return escapeText(inlineText(childText(value), hole.trimStart, hole.trimEnd));
    case 'html':
      return childText(value);
    case 'slot':
      return slottedHtml(hole.name, slotText(value));
    case 'rule':
      return isSet(value) ? `  ${hole.selector} { ${String(value)} }` : '';
    case 'style':
      return isSet(value)
        ? `${styleElement([{ selector: hole.selector, declarations: String(value) }])}\n`
        : '';
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      return unknownHoleKind(hole);
  }
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
