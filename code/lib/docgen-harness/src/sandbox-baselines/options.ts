import { SandboxBaselineError } from './error.ts';
import { parseArgs } from 'node:util';

import { z } from 'zod';

const OPTIONS = {
  template: { type: 'string' },
  sandbox: { type: 'string' },
  update: { type: 'boolean', short: 'u', default: false },
  capture: { type: 'string' },
  compare: { type: 'boolean' },
  static: { type: 'string' },
  out: { type: 'string' },
  framework: { type: 'string' },
  waivers: { type: 'string' },
  report: { type: 'string' },
  'snippet-timeout': { type: 'string' },
} as const;

const nonempty = z.string().min(1);
const baselineSchema = z.object({
  template: nonempty.optional(),
  sandboxDir: nonempty.optional(),
  update: z.boolean().default(false),
});
const captureSchema = z.object({
  mode: z.literal('capture'),
  engine: z.enum(['legacy', 'server']),
  staticDir: nonempty,
  out: nonempty,
  snippetTimeout: z.coerce.number().int().positive().default(1000),
});
const compareSchema = z.object({
  mode: z.literal('compare'),
  before: nonempty,
  after: nonempty,
  framework: z.enum(['svelte', 'vue3', 'angular', 'web-components']),
  waivers: nonempty.optional(),
  report: nonempty.default('.'),
});
export type BaselineRunOptions = z.infer<typeof baselineSchema>;
export type CaptureRunOptions = z.infer<typeof captureSchema>;
export type CompareRunOptions = z.infer<typeof compareSchema>;

export function parseBaselineRunOptions(
  argv: string[]
): BaselineRunOptions | CaptureRunOptions | CompareRunOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: OPTIONS,
    allowPositionals: true,
  });
  if (values.capture !== undefined || values.compare) {
    if (
      (values.capture !== undefined && values.compare) ||
      values.template !== undefined ||
      values.sandbox !== undefined ||
      values.update
    ) {
      throw new SandboxBaselineError(
        'invalid options: capture and compare are exclusive and cannot use template, sandbox or update'
      );
    }
    if (values.capture !== undefined) {
      if (
        positionals.length ||
        values.framework !== undefined ||
        values.waivers !== undefined ||
        values.report !== undefined
      )
        throw new SandboxBaselineError('invalid options: capture does not accept comparison flags');
      return captureSchema.parse({
        mode: 'capture',
        engine: values.capture,
        staticDir: values.static,
        out: values.out,
        snippetTimeout: values['snippet-timeout'],
      });
    }
    if (
      positionals.length !== 2 ||
      values.static !== undefined ||
      values.out !== undefined ||
      values['snippet-timeout'] !== undefined
    )
      throw new SandboxBaselineError('invalid options: compare requires two capture directories');
    return compareSchema.parse({
      mode: 'compare',
      before: positionals[0],
      after: positionals[1],
      framework: values.framework,
      waivers: values.waivers,
      report: values.report,
    });
  }
  if (
    positionals.length ||
    values.static !== undefined ||
    values.out !== undefined ||
    values.framework !== undefined ||
    values.waivers !== undefined ||
    values.report !== undefined ||
    values['snippet-timeout'] !== undefined
  )
    throw new SandboxBaselineError('invalid options: capture or compare required');
  const result = baselineSchema.safeParse({
    template: values.template,
    sandboxDir: values.sandbox,
    update: values.update,
  });
  if (!result.success) throw new SandboxBaselineError(`invalid options: ${result.error.message}`);
  return result.data;
}
