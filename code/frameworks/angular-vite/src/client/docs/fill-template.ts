import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  writtenCode,
} from 'storybook/internal/docs-tools';

import {
  escapeAttributeExpression,
  escapeTemplateLiteral,
  printExpressionValue,
} from '../../template-grammar.ts';

/**
 * Fills a template from the story-docs build with the story's current args. Each hole is where
 * the static snippet prints an arg's value, and its kind says how that spot prints one:
 *
 * - `⟦bind name⟧` is the expression of a `[name]="…"` binding.
 * - `⟦prop name⟧` is a whole `[name]="…"` binding, which an unset arg leaves out, as
 *   `argsToTemplate` does.
 * - `⟦field name⟧` is the code of a host component field.
 * - `⟦text name⟧` is text the story's markup interpolates, with the `{`, `}` and `@` Angular would
 *   read as its own syntax escaped as Angular escapes them.
 *
 * A `+n` word indents the lines after the first by `n` spaces, as the snippet indents a value over
 * several lines there. An arg the story writes as code, which the preview passes as that code,
 * prints as it; any other prints as `printExpressionValue` prints it, which the build prints the
 * story's args with too.
 */
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, [arg = '', indentWord]) => {
    const value = args[arg];
    const printed = (() => {
      switch (kind) {
        case 'bind':
          return escapeTemplateLiteral(escapeAttributeExpression(expression(value, arg)));
        case 'prop':
          return !Object.hasOwn(args, arg) || value === undefined || typeof value === 'function'
            ? ''
            : escapeTemplateLiteral(
                `[${arg}]="${escapeAttributeExpression(expression(value, arg))}"`
              );
        case 'field':
          return expression(value, arg);
        case 'text':
          return escapeTemplateLiteral(
            text(value, arg).replace(/[{}@]/g, (char) => TEXT_ESCAPES[char]!)
          );
        default:
          throw new UnprintableArgError(arg);
      }
    })();
    const indent = indentWord?.startsWith('+') ? ' '.repeat(Number(indentWord.slice(1))) : '';
    return printed.replaceAll('\n', `\n${indent}`);
  });

const TEXT_ESCAPES: Record<string, string> = { '{': "{{ '{' }}", '}': "{{ '}' }}", '@': '&#64;' };

const expression = (value: unknown, arg: string): string => {
  const code = writtenCode(value);
  if (code !== undefined) {
    return code;
  }
  // An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new UnprintableArgError(arg);
  }
  return printExpressionValue(value, () => {
    throw new UnprintableArgError(arg);
  });
};

const text = (value: unknown, arg: string): string => {
  const code = writtenCode(value);
  if (code !== undefined) {
    return code;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new UnprintableArgError(arg);
};
