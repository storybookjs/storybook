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

/** parseArgs keys flags as written, so `--fan-out` arrives as `fan-out`; schema keys are camelCase. */
function toCamelCase(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Flags reach the schema camel-cased, so only genuine renames (`--out` onto `outDir`) need
 * `toInput`, which spreads renamed keys into `safeParse` the way eval.ts does.
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
  const flags = Object.fromEntries(
    Object.entries(values).map(([flag, value]) => [toCamelCase(flag), value])
  );
  const result = schema.safeParse(toInput ? toInput(flags) : flags);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  --${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`invalid options:\n${issues}`);
  }
  return result.data as Out;
}
