import {
  type PrintHole,
  UnprintableArgError,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';

import {
  type AngularHolePlace,
  escapeAttributeExpression,
  escapeTemplateLiteral,
  inputBinding,
  printExpressionValue,
  textValue,
} from '../../snippet-values.ts';

// Fills a hole of a story's template with an arg a control changed, printed as the build prints
// the story's own args there: every value prints with `snippet-values.ts`. `AngularHolePlace`
// names each place.
export const printHole: PrintHole<AngularHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  const unprintable = (): never => {
    throw new UnprintableArgError(arg);
  };
  const expression = () => escapeAttributeExpression(printExpressionValue(value, unprintable));
  switch (hole.kind) {
    case 'bind':
      return escapeTemplateLiteral(expression());
    case 'prop':
      // `argsToTemplate` binds no input for an unset arg, and a function as an output instead.
      return value === undefined || typeof value === 'function'
        ? ''
        : escapeTemplateLiteral(inputBinding(arg, expression()));
    case 'field':
      return printExpressionValue(value, unprintable);
    case 'text':
      return escapeTemplateLiteral(text(value) ?? unprintable());
    default:
      return unknownHoleKind(hole.kind);
  }
};

// Text prints as written, and a cleared arg as none. Angular reads `{`, `}` and `@` in text as its
// own syntax, so they print as character references, which read as text. Text holding `{{` has
// none: Angular reads a `{{` it decodes from references as an interpolation too. A `$` at the end
// prints as a reference too, so it never makes `${` with the code after it in the template literal.
const text = (value: unknown): string | undefined => {
  if (value === undefined) {
    return '';
  }
  const printed = textValue(value);
  return printed?.includes('{{')
    ? undefined
    : printed?.replace(/[{}@]|\$$/g, (syntax) => `&#${syntax.charCodeAt(0)};`);
};
