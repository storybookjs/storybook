import { type ParseArgsConfig, parseArgs } from 'node:util';

import { z } from 'zod';

type OptionsConfig = NonNullable<ParseArgsConfig['options']>;

/** parseArgs yields strings, so numeric flags are coerced here */
export const countOption = (fallback: number) =>
  z.coerce.number().int().nonnegative().default(fallback);

/**
 * A count a run cannot be made of zero of - a multiplier, say. Rejecting it here is what stops the
 * flag being accepted and then quietly raised to something the caller did not ask for.
 */
export const positiveCountOption = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

/**
 * parseArgs keys flags as written, so `--fan-out` arrives as `fan-out`; schema keys are camelCase.
 * A schema key that is not exactly its flag's camelCase — `maxRetainedGrowthMb` for
 * `--max-retained-growth` — must still be renamed in `toInput`, or Zod silently uses its default.
 */
function toCamelCase(flag: string): string {
  return flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * `Out` is asserted rather than inferred from the schema, which is not the obvious choice: returning
 * `z.infer<Schema>` would make the two check against each other. It does not work here. `scripts`
 * compiles with `strictNullChecks: false`, and under that flag Zod's `addQuestionMarks` finds no
 * required keys, so every inferred field comes back optional and satisfies no caller's option type.
 * Prefer `type Options = z.infer<typeof SCHEMA>` at the call site where the schema is the whole
 * contract - that removes the second declaration this cast could drift from.
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
