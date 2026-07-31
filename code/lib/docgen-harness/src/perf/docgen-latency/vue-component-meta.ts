import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { parseHarnessOptions } from '../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../docgen-shared/paths.ts';
import {
  type Pin,
  createVueComponentMetaEngine,
  loadCheckers,
} from '../docgen-perf/engines/vue-component-meta.ts';
import {
  type LatencySummary,
  type WorkSignature,
  assertValidIterationCount,
  createFreshEngineTask,
  createResettableBench,
  mapTaskResult,
} from './resettable-bench.ts';

const require = createRequire(import.meta.url);
const PINS = ['current', 'next'] as const;
const DEFAULT_ITERATIONS = 15;
const QUICK_ITERATIONS = 3;

const OPTIONS = {
  quick: { type: 'boolean' },
  iterations: { type: 'string' },
  json: { type: 'string' },
} as const;

const SCHEMA = z.object({
  quick: z.boolean().default(false),
  iterations: z.coerce.number().int().min(2, 'must be at least 2').optional(),
  jsonOut: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-latency', 'results.json')),
});

export interface Options {
  quick: boolean;
  iterations?: number;
  jsonOut: string;
}

interface EngineOutput {
  packageName: string;
  version: string;
  work: WorkSignature;
  latency: LatencySummary;
}

export function parseOptions(argv: string[]): Options {
  return parseHarnessOptions<Options>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    jsonOut: values.json,
  }));
}

export function packageVersion(packageName: string): string {
  let packagePath: string;
  try {
    packagePath = require.resolve(`${packageName}/package.json`);
  } catch {
    let directory = path.dirname(require.resolve(packageName));
    while (true) {
      const candidate = path.join(directory, 'package.json');
      if (fs.existsSync(candidate)) {
        packagePath = candidate;
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        throw new Error(`could not find package metadata for ${packageName}`);
      }
      directory = parent;
    }
  }
  const metadata = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: string };
  if (!metadata.version) {
    throw new Error(`${packageName} package metadata has no version`);
  }
  return metadata.version;
}

export async function runVueComponentMetaLatency(options: Options) {
  const iterations = options.iterations ?? (options.quick ? QUICK_ITERATIONS : DEFAULT_ITERATIONS);
  assertValidIterationCount(iterations);

  const versions = {
    current: packageVersion('vue-component-meta'),
    next: packageVersion('vue-component-meta-next'),
  };
  if (versions.current === versions.next) {
    throw new Error(`both pins resolved vue-component-meta ${versions.current}; not a comparison`);
  }

  const modules = {
    current: await loadCheckers('current'),
    next: await loadCheckers('next'),
  };
  const scenario = {
    name: 'flat' as const,
    packages: 1,
    componentsPerPackage: options.quick ? 5 : 20,
    chainDepth: 1,
    fanOut: options.quick ? 2 : 4,
    heavyLib: false,
  };
  const sharedWork: { value?: WorkSignature } = {};
  const taskEntries = PINS.map((pin) =>
    createFreshEngineTask(
      pin,
      () =>
        createVueComponentMetaEngine(
          {
            scenario: scenario.name,
            packages: scenario.packages,
            componentsPerPackage: scenario.componentsPerPackage,
            chainDepth: scenario.chainDepth,
            fanOut: scenario.fanOut,
            heavyLib: scenario.heavyLib,
            saves: 1,
            outDir: path.join(SANDBOX_DIRECTORY, 'docgen-latency', pin),
          },
          modules[pin]
        ),
      sharedWork
    )
  );

  const bench = createResettableBench(
    taskEntries.map(({ task }) => task),
    iterations
  );
  bench.runSync();

  const engines = Object.fromEntries(
    PINS.map((pin, index) => {
      const state = taskEntries[index].state;
      if (state.createdEngines !== iterations || !state.work) {
        throw new Error(
          `${pin} created ${state.createdEngines} engines, expected exactly ${iterations}`
        );
      }
      const packageName = pin === 'current' ? 'vue-component-meta' : 'vue-component-meta-next';
      return [
        pin,
        {
          packageName,
          version: versions[pin],
          work: state.work,
          latency: mapTaskResult(bench.results[index], iterations),
        } satisfies EngineOutput,
      ];
    })
  ) as Record<Pin, EngineOutput>;

  return {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    runner: { name: 'tinybench' as const, version: packageVersion('tinybench') },
    mode: 'descriptive' as const,
    gating: false,
    iterations,
    taskOrder: [...PINS],
    scenario,
    engines,
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const results = await runVueComponentMetaLatency(options);
  fs.mkdirSync(path.dirname(options.jsonOut), { recursive: true });
  fs.writeFileSync(options.jsonOut, JSON.stringify(results, null, 2));
  for (const pin of PINS) {
    const result = results.engines[pin];
    console.log(
      `${pin} ${result.version}: median=${result.latency.medianMs.toFixed(2)}ms ` +
        `samples=${result.latency.sampleCount}`
    );
  }
  console.log(`wrote ${options.jsonOut}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
