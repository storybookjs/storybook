import { type PrintHole, UnprintableArgError } from 'storybook/internal/docs-tools';

import {
  escapeAttributeExpression,
  escapeTemplateLiteral,
  indentLines,
  inputBinding,
  printExpressionValue,
  textValue,
} from '../../snippet-values.ts';

// Prints a changed arg for a hole of a template from the story-docs build, where the static
// snippet prints the arg's value:
//
// - `⟦bind arg⟫…⟧` is the expression of a `[name]="…"` binding.
// - `⟦prop arg⟫…⟧` is a whole `[name]="…"` binding, which an unset arg leaves out, as
//   `argsToTemplate` does.
// - `⟦field arg⟫…⟧` is the code of a host component field.
// - `⟦text arg⟫…⟧` is text the story's markup interpolates, as written.
//
// A `+n` word indents the lines after the first by `n` spaces, as the snippet indents a value over
// several lines there. Every value prints with `snippet-values.ts`, which the build prints the
// static snippet with.
export const printHole: PrintHole = ({ kind, arg = '', words: [indentWord] }, value) => {
  const indent = indentWord?.startsWith('+') ? ' '.repeat(Number(indentWord.slice(1))) : '';
  switch (kind) {
    case 'bind':
      return indentLines(
        escapeTemplateLiteral(escapeAttributeExpression(expression(value, arg))),
        indent
      );
    case 'prop':
      return value === undefined || typeof value === 'function'
        ? ''
        : indentLines(
            escapeTemplateLiteral(
              inputBinding(arg, escapeAttributeExpression(expression(value, arg)))
            ),
            indent
          );
    case 'field':
      return indentLines(expression(value, arg), indent);
    case 'text':
      return indentLines(escapeTemplateLiteral(text(value, arg)), indent);
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
  }
};

// The code an arg prints as. An Angular template has no `NaN` or `Infinity`; it would read them as
// component fields.
const expression = (value: unknown, arg: string): string => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new UnprintableArgError(arg);
  }
  return printExpressionValue(value, () => {
    throw new UnprintableArgError(arg);
  });
};

// Text prints as written, as the static snippet prints it. Text Angular would read as its own
// syntax, `{`, `}` or `@`, has no such snippet, so the static snippet is shown instead.
const text = (value: unknown, arg: string): string => {
  const printed = textValue(value);
  if (printed === undefined || /[{}@]/.test(printed)) {
    throw new UnprintableArgError(arg);
  }
  return printed;
};
