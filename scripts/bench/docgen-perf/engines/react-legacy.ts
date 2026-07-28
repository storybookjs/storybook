/**
 * Series harness for the legacy React docgen engines: `react-docgen` (the budgeted legacy control)
 * and `react-docgen-typescript` (measurable, no budget row).
 *
 * Both cache per file for the process lifetime and expose only global invalidation, so every save
 * must invalidate before re-extracting or the sample is a cache hit.
 *
 * Do not run this child under jiti - react-docgen's browserslist dependency fails its JSON data
 * require under that loader ("jsReleases.map is not a function").
 *
 * Run:
 *   node --expose-gc scripts/bench/docgen-perf/engines/react-legacy.ts \
 *     --parser react-docgen --components 300 --saves 20 --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { z } from 'zod';

import { componentSource, generateProject } from '../../docgen-memory/generate-project.ts';
import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type ReactDocgenModule,
  type ReactDocgenTypescriptModule,
  type UtilsModule,
  componentRef,
  loadRendererModule,
} from '../../docgen-shared/renderer-module.ts';
import {
  type SeriesEngine,
  harnessMain,
  runSeriesHarness,
} from '../../docgen-shared/series.ts';

const PARSERS = ['react-docgen', 'react-docgen-typescript'] as const;
/**
 * Which components to re-extract per save.
 *   all     - re-extract every component, the shape `generator.ts` actually runs.
 *   changed - re-extract only the component whose file changed.
 */
const SCOPES = ['all', 'changed'] as const;

const OPTIONS = {
  parser: { type: 'string' },
  components: { type: 'string' },
  variants: { type: 'string' },
  props: { type: 'string' },
  saves: { type: 'string' },
  scope: { type: 'string' },
  out: { type: 'string' },
  json: { type: 'string' },
} as const;

const SCHEMA = z.object({
  parser: z.enum(PARSERS).default('react-docgen'),
  components: countOption(300),
  variants: countOption(4),
  props: countOption(10),
  saves: countOption(20),
  scope: z.enum(SCOPES).default('changed'),
  outDir: z
    .string()
    .default(path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'react-legacy', 'project')),
  jsonOut: z.string().optional(),
});

interface HarnessOptions {
  parser: (typeof PARSERS)[number];
  components: number;
  variants: number;
  props: number;
  saves: number;
  scope: (typeof SCOPES)[number];
  outDir: string;
  jsonOut?: string;
}

function parseOptions(argv: string[]): HarnessOptions {
  return parseHarnessOptions<HarnessOptions>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    outDir: values.out,
    jsonOut: values.json,
  }));
}

async function createEngine(options: HarnessOptions): Promise<SeriesEngine> {
  const genStart = Date.now();
  const project = generateProject({
    outDir: options.outDir,
    components: options.components,
    variants: options.variants,
    props: options.props,
    heavyTypes: false,
    heavyFactor: 1,
    base64Kb: 0,
    withNodeModules: true,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  const { invalidateCache } = await loadRendererModule<UtilsModule>('utils.ts');

  let extractOne: (i: number) => Promise<void>;
  let invalidate: () => void;

  if (options.parser === 'react-docgen') {
    const { getReactDocgen } = await loadRendererModule<ReactDocgenModule>('reactDocgen.ts');
    extractOne = async (i) => {
      const componentPath = project.componentPaths[i];
      const result = getReactDocgen(componentPath, componentRef(i, componentPath));
      if (result.type === 'error') {
        throw new Error(
          `react-docgen failed on Comp${i}: ${result.error.name} ${result.error.message}`
        );
      }
    };
    invalidate = invalidateCache;
  } else {
    const { parseWithReactDocgenTypescript, invalidateParser } =
      await loadRendererModule<ReactDocgenTypescriptModule>('reactDocgenTypescript.ts');
    // The parser resolves its tsconfig from process.cwd(); point it at the generated project.
    process.chdir(project.outDir);
    extractOne = async (i) => {
      const docs = await parseWithReactDocgenTypescript(project.componentPaths[i]);
      if (docs.length === 0) {
        throw new Error(`react-docgen-typescript returned no docs for Comp${i}`);
      }
    };
    invalidate = () => {
      invalidateParser();
      invalidateCache();
    };
  }

  const extractAll = async () => {
    for (let i = 0; i < options.components; i++) {
      await extractOne(i);
    }
  };

  // Track how many extra props each component currently has, so each save grows its type.
  const extraByComponent = new Array<number>(options.components).fill(options.props);
  const changedIndex = (save: number) => (save - 1) % options.components;

  return {
    async cold() {
      await extractAll();
      return undefined;
    },
    async applySave(save) {
      const i = changedIndex(save);
      extraByComponent[i] += 1;
      fs.writeFileSync(project.componentPaths[i], componentSource(i, extraByComponent[i]));
      // Global invalidation is the only surface these engines expose; without it the re-extraction
      // below is a cache hit.
      invalidate();
    },
    async reextract(save) {
      if (options.scope === 'all') {
        await extractAll();
      } else {
        await extractOne(changedIndex(save));
      }
      return undefined;
    },
  };
}

harnessMain(async () => {
  const options = parseOptions(process.argv.slice(2));
  await runSeriesHarness({
    title: `react-legacy harness (${options.parser})`,
    options,
    banner: {
      components: options.components,
      variants: options.variants,
      props: options.props,
      saves: options.saves,
      scope: options.scope,
    },
    saves: options.saves,
    coldLabel: `${options.components} components`,
    jsonOut: options.jsonOut,
    setup: () => createEngine(options),
  });
});
