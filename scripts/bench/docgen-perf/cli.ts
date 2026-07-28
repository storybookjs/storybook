/** Command line for the docgen perf suite. */
import * as path from 'node:path';

import { Args } from '../docgen-shared/args.ts';
import { ALL_ENGINE_IDS, DEFAULT_ENGINE_IDS } from './registry.ts';
import type { EngineId } from './types.ts';

export interface CliOptions {
  quick: boolean;
  engines: EngineId[];
  jsonOut: string;
}

export function parseCliOptions(argv: string[], workRoot: string): CliOptions {
  const args = new Args(argv);
  const engines = args.all('engine');
  for (const engine of engines) {
    if (!ALL_ENGINE_IDS.includes(engine as EngineId)) {
      throw new Error(`--engine must be one of ${ALL_ENGINE_IDS.join(', ')}, got "${engine}"`);
    }
  }
  return {
    quick: args.flag('quick'),
    engines: engines.length ? (engines as EngineId[]) : DEFAULT_ENGINE_IDS,
    jsonOut: args.string('json', path.join(workRoot, 'results.json')),
  };
}
