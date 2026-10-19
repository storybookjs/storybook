import { babelParse, types as t } from 'storybook/internal/babel';
import type { ArgTypes } from 'storybook/internal/types';

import { printTemplate } from './print-template.ts';
import { readStaticArgs } from './static-args.ts';

export function printSvelteCsfSnippet({
  code,
  args,
  argTypes,
  expressions = {},
}: {
  code: string;
  args: Record<string, unknown>;
  argTypes: ArgTypes;
  expressions?: Record<string, string>;
}): string {
  const omitDefaults: Record<string, unknown> = {};
  for (const [key, argType] of Object.entries(argTypes)) {
    const summary = argType.table?.defaultValue?.summary;
    if (typeof summary !== 'string') continue;
    try {
      const statement = babelParse(`(${summary})`).program.body[0];
      if (!t.isExpressionStatement(statement)) continue;
      const result = readStaticArgs({ [key]: statement.expression });
      if (result.unresolved.length === 0) Object.assign(omitDefaults, result.args);
    } catch {
      continue;
    }
  }
  return printTemplate({ code, args, expressions, omitDefaults });
}
