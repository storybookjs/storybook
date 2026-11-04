import {
  type PrintHole,
  UnprintableArgError,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';

import {
  type AngularHolePlace,
  escapeAttributeExpression,
  escapeTemplateLiteral,
  indentLines,
  inputBinding,
  printExpressionValue,
  textValue,
} from '../../snippet-values.ts';

// Prints a changed arg for a hole of a template from the story-docs build, for the place where the
// static snippet prints the arg's value; `AngularHolePlace` names each place. Every value prints
// with `snippet-values.ts`, which the build prints the static snippet with.
export const printHole: PrintHole<AngularHolePlace> = (hole, value) => {
  const unprintable = (): never => {
    throw new UnprintableArgError(hole.arg ?? '');
  };
  switch (hole.kind) {
    case 'bind':
      return escapeTemplateLiteral(
        escapeAttributeExpression(printExpressionValue(value, unprintable))
      );
    case 'prop':
      // `argsToTemplate` binds no input for an unset arg, and a function as an output instead.
      return value === undefined || typeof value === 'function'
        ? ''
        : escapeTemplateLiteral(
            inputBinding(
              hole.arg ?? '',
              escapeAttributeExpression(printExpressionValue(value, unprintable))
            )
          );
    case 'field':
      // A class field is TypeScript, which writes `NaN` and `Infinity` as they are.
      return printExpressionValue(value, (unprinted) =>
        typeof unprinted === 'number' ? String(unprinted) : unprintable()
      );
    case 'text':
      return indentLines(
        escapeTemplateLiteral(text(value) ?? unprintable()),
        ' '.repeat(hole.indent ?? 0)
      );
    default:
      return unknownHoleKind(hole);
  }
};

// Text prints as written, as the static snippet prints it, and a cleared arg as none. Angular reads
// `{`, `}` and `@` in text as its own syntax, so they print as the character references Angular
// asks for, but `{{` as the string `'{{'` interpolated: Angular reads a `{{` it decodes from
// references as an interpolation too.
const text = (value: unknown): string | undefined =>
  value === undefined
    ? ''
    : textValue(value)?.replace(/\{\{|[{}@]/g, (syntax) =>
        syntax === '{{' ? "{{ '{{' }}" : `&#${syntax.charCodeAt(0)};`
      );
