import { type PrintHole, UnprintableArgError } from 'storybook/internal/docs-tools';

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

// Prints a changed arg for a hole of a template from `build-story-docs.ts`, with the printer the
// static snippet prints a value in that place with:
//
// - `⟦attr arg name mode⟫…⟧`: an attribute, or nothing. No mode: the attribute Storybook's render
//   sets; `field`: as that, but `name=""` while empty; `bind`: lit's `name=${arg}`; `defined`:
//   lit's `name=${ifDefined(arg)}`, left out while unset.
// - `⟦bool arg name⟫…⟧`: lit's `?name=${arg}`.
// - `⟦quoted arg⟫…⟧`: text in a quoted attribute value.
// - `⟦css arg property⟫…⟧`: a custom property in the `style` attribute, and `⟦cssattr arg
//   property⟫⟧` the `style` attribute of it alone.
// - `⟦text arg⟫…⟧`: the text of a lit template, trimmed at a `^` start or `$` end as the snippet
//   prints a text node there; `⟦html arg⟫…⟧`: the html of a string template.
// - `⟦slot arg name⟫…⟧`: the html of a slot.
// - `⟦rule arg selector⟫…⟧`: a part or state rule in the `<style>`, and `⟦style arg selector⟫⟧`
//   the `<style>` of it alone, with the line break after it.
// - `⟦guard arg⟫⟧`: an arg the template reads where the snippet cannot follow it.
export const printHole: PrintHole = ({ kind, arg = '', words }, changed) => {
  const value = printable(arg, changed);
  const [first = '', mode] = words;
  switch (kind) {
    case 'attr':
      if (mode === 'bind' || mode === 'defined') {
        return mode === 'defined' && !isDefined(value)
          ? ''
          : quotedAttribute(first, boundText(value));
      }
      return printAttribute(first, value, mode === 'field') ?? '';
    case 'bool':
      // Lit sets the attribute while the value is truthy, as the static snippet reads it.
      return isTruthy(value) ? first : '';
    case 'quoted':
      return escapeAttribute(boundText(value));
    case 'css':
      return escapeAttribute(cssDeclarations([{ name: first, value }]) ?? '');
    case 'cssattr': {
      const style = cssDeclarations([{ name: first, value }]);
      return style === undefined ? '' : quotedAttribute('style', style);
    }
    case 'text':
      return escapeText(inlineText(childText(value), words.includes('^'), words.includes('$')));
    case 'html':
      return childText(value);
    case 'slot':
      return slottedHtml(first, slotText(value));
    case 'rule':
      return isSet(value) ? `  ${first} { ${String(value)} }` : '';
    case 'style':
      return isSet(value)
        ? `${styleElement([{ selector: first, declarations: String(value) }])}\n`
        : '';
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
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
