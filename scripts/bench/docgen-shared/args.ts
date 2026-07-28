/**
 * Option parsing for the docgen bench harnesses: `node:util` parseArgs in strict mode for the
 * parse, then a Zod schema for coercion and validation. Same pairing as scripts/eval/eval.ts.
 *
 * Strict mode is what makes this worth doing. It rejects a flag the harness does not declare, so
 * `--component 5` with the `s` missing fails loudly instead of leaving the default in place and
 * reporting a benchmark for a project size nobody asked for.
 */
import { type ParseArgsConfig, parseArgs } from 'node:util';

import { z } from 'zod';

type OptionsConfig = NonNullable<ParseArgsConfig['options']>;

/** parseArgs yields strings, so numeric flags are coerced here rather than at each call site. */
export const countOption = (fallback: number) =>
  z.coerce.number().int().nonnegative().default(fallback);

/**
 * Keys in `values` are the flags as written, so kebab-case flags arrive kebab-cased. `toInput` maps
 * them onto the schema's shape, the way eval.ts spreads renamed keys into `safeParse`.
 *
 * `Out` is supplied by the caller rather than inferred: under this TypeScript setup zod 3 types a
 * `.default()` key as optional even on the parsed output, so inference would make every defaulted
 * option optional at the call site. The harness interfaces stay the source of truth, and
 * args.test.ts asserts that a parse with no arguments really does populate every field.
 */
export function parseHarnessOptions<Out>(
  argv: string[],
  options: OptionsConfig,
  schema: z.ZodTypeAny,
  toInput?: (values: Record<string, unknown>) => Record<string, unknown>
): Out {
  const { values } = parseArgs({ args: argv, options, strict: true });
  const result = schema.safeParse(toInput ? toInput(values) : values);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  --${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid options:\n${issues}`);
  }
  return result.data as Out;
}
