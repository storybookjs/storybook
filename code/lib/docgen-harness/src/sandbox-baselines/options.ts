import { z } from 'zod';

import { parseHarnessOptions } from '../perf/docgen-shared/args.ts';

const OPTIONS = {
  template: { type: 'string' },
  sandbox: { type: 'string' },
  update: { type: 'boolean', short: 'u', default: false },
} as const;

export interface BaselineRunOptions {
  /** Absent means every server-docgen template. */
  template?: string;
  sandboxDir?: string;
  update: boolean;
}

export function parseBaselineRunOptions(argv: string[]): BaselineRunOptions {
  // An empty `--template=` has to be rejected rather than treated as absent: the caller named a
  // template, and reading it as "no template given" would quietly widen the run to all of them.
  const schema = z.object({
    template: z.string().min(1).optional(),
    sandboxDir: z.string().min(1).optional(),
    update: z.boolean().default(false),
  });
  return parseHarnessOptions<BaselineRunOptions>(argv, OPTIONS, schema, (values) => ({
    ...values,
    sandboxDir: values.sandbox,
  }));
}
