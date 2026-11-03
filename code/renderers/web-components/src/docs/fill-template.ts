import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
} from 'storybook/internal/docs-tools';

import {
  boundText,
  childText,
  cssDeclarations,
  escapeAttribute,
  escapeText,
  inlineText,
  printAttribute,
  quotedAttribute,
  slotText,
  slottedHtml,
  styleText,
} from '../snippet-values.ts';

// Fills a template from `build-story-docs.ts`: the html of the static snippet with a hole wherever
// it prints an arg. Each hole prints its arg's value with the printer the static snippet prints a
// value in that place with; the layout is the template's.
//
// `⟦attr name arg mode⟧` is an attribute, or nothing:
// - no mode: the attribute Storybook's render sets; `field`: as that, but `name=""` while empty.
// - `bind`: lit's `name=${arg}`, its value the arg's text; `defined`: lit's
//   `name=${ifDefined(arg)}`, left out while unset.
// - `css`, with words `property=arg`: the `style` attribute of the custom properties.
// `⟦bool name arg⟧` is lit's `?name=${arg}`, `⟦quoted arg⟧` text in a quoted attribute value,
// `⟦text arg⟧` the text of a lit template, trimmed at a `^` start or `$` end as the snippet prints a
// text node there, `⟦html arg⟧` the html of a string template, `⟦slot name arg⟧` the html of a slot,
// and `⟦style selector=arg…⟧` the `<style>` of part and state args with the line break after it.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = '', mode, ...rest] = words;
    const value = (arg: string) => printable(arg, args[arg]);
    switch (kind) {
      case 'attr':
        if (mode === 'css') {
          const properties = rest.map((word) => {
            const [name = '', arg = ''] = word.split(/=(.*)/);
            return { name, value: value(arg) };
          });
          const style = cssDeclarations(properties);
          return style === undefined ? '' : quotedAttribute('style', style);
        }
        if (mode === 'bind' || mode === 'defined') {
          const bound = value(second);
          return mode === 'defined' && (bound === null || bound === undefined)
            ? ''
            : quotedAttribute(first, boundText(bound));
        }
        return printAttribute(first, value(second), mode === 'field') ?? '';
      case 'bool':
        // Lit sets the attribute while the value is truthy, as the static snippet reads it.
        return value(second) ? first : '';
      case 'quoted':
        return escapeAttribute(boundText(value(first)));
      case 'text':
        return escapeText(
          inlineText(childText(value(first)), words.includes('^'), words.includes('$'))
        );
      case 'html':
        return childText(value(first));
      case 'slot':
        return slottedHtml(first, slotText(value(second)));
      case 'style': {
        const rules = words.flatMap((word) => {
          const [selector = '', arg = ''] = word.split(/=(.*)/);
          const declarations = value(arg);
          return declarations === undefined
            ? []
            : [{ selector, declarations: String(declarations) }];
        });
        return rules.length === 0 ? '' : `<style>${styleText(rules)}</style>\n`;
      }
      default:
        // A hole of another renderer's template, which this one cannot print.
        throw new UnprintableArgError(words[1] ?? words[0] ?? kind);
    }
  });

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
