import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  writtenCode,
} from 'storybook/internal/docs-tools';

import {
  escapeAttributeExpression,
  escapeTemplateLiteral,
  indentLines,
  inputBinding,
  printExpressionValue,
  textValue,
} from '../../snippet-values.ts';

/**
 * Fills a template from the story-docs build with the story's current args. Each hole is where
 * the static snippet prints an arg's value, and its kind says how that spot prints one:
 *
 * - `⟦bind name⟧` is the expression of a `[name]="…"` binding.
 * - `⟦prop name⟧` is a whole `[name]="…"` binding, which an unset arg leaves out, as
 *   `argsToTemplate` does.
 * - `⟦field name⟧` is the code of a host component field.
 * - `⟦text name⟧` is text the story's markup interpolates, as written.
 *
 * A `+n` word indents the lines after the first by `n` spaces, as the snippet indents a value over
 * several lines there. Every value prints with `snippet-values.ts`, which the build prints the
 * static snippet with.
 */
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, [arg = '', indentWord]) => {
    const value = args[arg];
    const indent = indentWord?.startsWith('+') ? ' '.repeat(Number(indentWord.slice(1))) : '';
    switch (kind) {
      case 'bind':
        return indentLines(
          escapeTemplateLiteral(escapeAttributeExpression(expression(value, arg))),
          indent
        );
      case 'prop':
        return !Object.hasOwn(args, arg) || value === undefined || typeof value === 'function'
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
  });

// The code an arg prints as: the code the story writes it with while unchanged, else its value.
// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const expression = (value: unknown, arg: string): string => {
  const code = writtenCode(value);
  if (code !== undefined) {
    return code;
  }
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
  const printed = writtenCode(value) ?? textValue(value);
  if (printed === undefined || /[{}@]/.test(printed)) {
    throw new UnprintableArgError(arg);
  }
  return printed;
};
