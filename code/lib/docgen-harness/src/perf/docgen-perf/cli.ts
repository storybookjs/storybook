/** Command line for the docgen perf suite. */
import * as path from 'node:path';

import { z } from 'zod';

import { parseHarnessOptions } from '../docgen-shared/args.ts';
import { ALL_ENGINE_IDS, DEFAULT_ENGINE_IDS } from './registry.ts';
import type { EngineId } from './types.ts';

const OPTIONS = {
  quick: { type: 'boolean' },
  engine: { type: 'string', multiple: true },
  json: { type: 'string' },
} as const;

export interface CliOptions {
  quick: boolean;
  engines: EngineId[];
  jsonOut: string;
}

export function parseCliOptions(argv: string[], workRoot: string): CliOptions {
  const schema = z.object({
    quick: z.boolean().default(false),
    // No --engine means the default set, which is why this defaults to empty rather than to
    // DEFAULT_ENGINE_IDS: an explicit empty list and an absent flag are the same request.
    engines: z.array(z.enum(ALL_ENGINE_IDS as [EngineId, ...EngineId[]])).default([]),
    jsonOut: z.string().default(path.join(workRoot, 'results.json')),
  });
  const options = parseHarnessOptions<CliOptions>(argv, OPTIONS, schema, (values) => ({
    ...values,
    engines: values.engine,
    jsonOut: values.json,
  }));
  return {
    ...options,
    engines: options.engines.length ? options.engines : DEFAULT_ENGINE_IDS,
  };
}
