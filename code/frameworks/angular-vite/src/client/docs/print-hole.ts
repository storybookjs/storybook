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
// static snippet prints the arg's value; `AngularHolePlace` names each place. A value over several
// lines is indented by the place's `indent`, as the snippet indents one there. Every value prints
// with `snippet-values.ts`, which the build prints the static snippet with.
export const printHole: PrintHole<AngularHolePlace> = ({ place, arg = '' }, value) => {
  const indent = ' '.repeat(place.indent ?? 0);
  switch (place.kind) {
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
      return unknownHoleKind(place.kind);
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
