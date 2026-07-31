/** Command line for descriptive runs and explicit paired timing gates. */
import * as path from 'node:path';

import { z } from 'zod';

import { parseHarnessOptions } from '../docgen-shared/args.ts';
import { COMPARISON_PAIRS, type PairName } from './comparison.ts';
import { MIN_PAIRED_REPETITIONS } from './config.ts';
import { ALL_ENGINE_IDS, DEFAULT_ENGINE_IDS } from './registry.ts';
import type { EngineId } from './types.ts';

const PAIR_NAMES = COMPARISON_PAIRS.map(({ name }) => name) as [PairName, ...PairName[]];

const OPTIONS = {
  quick: { type: 'boolean' },
  engine: { type: 'string', multiple: true },
  json: { type: 'string' },
  compare: { type: 'string' },
  seed: { type: 'string' },
  repetitions: { type: 'string' },
  'max-regression': { type: 'string' },
} as const;

export interface CliOptions {
  quick: boolean;
  engines: EngineId[];
  jsonOut: string;
  compare?: PairName;
  seed?: number;
  repetitions?: number;
  maxRegression?: number;
}

export function parseCliOptions(argv: string[], workRoot: string): CliOptions {
  const schema = z.object({
    quick: z.boolean().default(false),
    engines: z.array(z.enum(ALL_ENGINE_IDS as [EngineId, ...EngineId[]])).default([]),
    jsonOut: z.string().default(path.join(workRoot, 'results.json')),
    compare: z.enum(PAIR_NAMES).optional(),
    seed: z.coerce.number().int().min(0).max(0xffff_ffff).optional(),
    repetitions: z.coerce.number().int().positive().optional(),
    maxRegression: z.coerce.number().finite().nonnegative().optional(),
  });
  const options = parseHarnessOptions<CliOptions>(argv, OPTIONS, schema, (values) => ({
    ...values,
    engines: values.engine,
    jsonOut: values.json,
  }));

  if (options.compare) {
    const repetitions = options.repetitions ?? MIN_PAIRED_REPETITIONS;
    if (repetitions < MIN_PAIRED_REPETITIONS || repetitions % 2 !== 0) {
      throw new Error(
        `--compare requires an even --repetitions of at least ${MIN_PAIRED_REPETITIONS}`
      );
    }
    if (options.maxRegression === undefined) {
      throw new Error('--compare requires an explicit --max-regression fraction');
    }
    const pair = COMPARISON_PAIRS.find(({ name }) => name === options.compare)!;
    const selected = options.engines.length ? options.engines : [pair.control, pair.candidate];
    if (!selected.includes(pair.control) || !selected.includes(pair.candidate)) {
      throw new Error(
        `--compare ${pair.name} requires --engine ${pair.control} and --engine ${pair.candidate}`
      );
    }
    if (selected.some((engine) => engine !== pair.control && engine !== pair.candidate)) {
      throw new Error('--compare runs exactly one pair; remove unrelated --engine selections');
    }
    return { ...options, repetitions, engines: selected };
  }

  if (
    options.seed !== undefined ||
    options.repetitions !== undefined ||
    options.maxRegression !== undefined
  ) {
    throw new Error('--seed, --repetitions, and --max-regression require --compare');
  }
  return {
    ...options,
    engines: options.engines.length ? options.engines : DEFAULT_ENGINE_IDS,
  };
}
