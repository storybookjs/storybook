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
 * Run from code/lib/docgen-harness:
 *   node --expose-gc src/perf/docgen-perf/engines/react-legacy.ts \
 *     --parser react-docgen --components 300 --saves 20 --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { z } from 'zod';

import {
  type GeneratedProject,
  componentRef,
  componentSource,
  generateProject,
} from '../../docgen-memory/generate-project.ts';
import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type ComponentRefLike,
  loadReactRendererModule,
} from '../../docgen-shared/react-renderer-module.ts';
import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';

/** The renderer module surfaces this harness loads, narrowed to what it calls. */
interface UtilsModule {
  invalidateCache(): void;
}

interface ReactDocgenModule {
  getReactDocgen(
    path: string,
    component: ComponentRefLike
  ): { type: 'success' } | { type: 'error'; error: { name: string; message: string } };
}

interface ReactDocgenTypescriptModule {
  parseWithReactDocgenTypescript(filePath: string): Promise<Array<{ exportName?: string }>>;
  invalidateParser(): void;
}

const PARSERS = ['react-docgen', 'react-docgen-typescript'] as const;
/**
 * Which components to re-extract per save.
 *   all     - re-extract every component, the shape `generator.ts` actually runs.
 *   changed - re-extract only the component whose file changed.
 */
const SCOPES = ['all', 'changed'] as const;
/** The two shapes the OSA harness runs, so the legacy engine can be compared on either. */
const SHAPES = ['whole-index', 'first-story'] as const;

const OPTIONS = {
  parser: { type: 'string' },
  shape: { type: 'string' },
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
  shape: z.enum(SHAPES).default('whole-index'),
  outDir: z
    .string()
    .default(path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'react-legacy', 'project')),
  jsonOut: z.string().optional(),
});

type HarnessOptions = z.infer<typeof SCHEMA>;

function parseOptions(argv: string[]): HarnessOptions {
  return parseHarnessOptions<HarnessOptions>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    outDir: values.out,
    jsonOut: values.json,
  }));
}

interface Parser {
  /** Extract `Comp{i}`. Throws on a failed or empty result, which is fast for the wrong reason. */
  extractOne(i: number): Promise<void>;
  /** Global invalidation is the only surface these engines expose. */
  invalidate(): void;
}

async function loadParser(options: HarnessOptions, project: GeneratedProject): Promise<Parser> {
  const { componentPaths } = project;
  const { invalidateCache } = await loadReactRendererModule<UtilsModule>('utils.ts');

  if (options.parser === 'react-docgen') {
    const { getReactDocgen } = await loadReactRendererModule<ReactDocgenModule>('reactDocgen.ts');
    return {
      async extractOne(i) {
        const result = getReactDocgen(componentPaths[i], componentRef(i, componentPaths[i]));
        if (result.type === 'error') {
          throw new Error(
            `react-docgen failed on Comp${i}: ${result.error.name} ${result.error.message}`
          );
        }
      },
      invalidate: invalidateCache,
    };
  }

  const { parseWithReactDocgenTypescript, invalidateParser } =
    await loadReactRendererModule<ReactDocgenTypescriptModule>('reactDocgenTypescript.ts');
  // The parser resolves its tsconfig from process.cwd(); point it at the generated project.
  process.chdir(project.outDir);
  return {
    async extractOne(i) {
      const docs = await parseWithReactDocgenTypescript(componentPaths[i]);
      if (docs.length === 0) {
        throw new Error(`react-docgen-typescript returned no docs for Comp${i}`);
      }
    },
    invalidate() {
      invalidateParser();
      invalidateCache();
    },
  };
}

async function createEngine(options: HarnessOptions): Promise<SeriesEngine> {
  // Re-extracting everything after a save is the other shape wearing this one's name.
  if (options.shape === 'first-story' && options.scope === 'all') {
    throw new Error('--shape first-story requires --scope changed');
  }

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

  const { extractOne, invalidate } = await loadParser(options, project);

  const extractAll = async () => {
    for (let i = 0; i < options.components; i++) {
      await extractOne(i);
    }
  };

  // Track how many extra props each component currently has, so each save grows its type.
  const extraByComponent = new Array<number>(options.components).fill(options.props);
  const firstStory = options.shape === 'first-story';
  // Fixed at the component the cold pass documented; round-robin would keep documenting new ones.
  const changedIndex = (save: number) => (firstStory ? 0 : (save - 1) % options.components);

  return {
    async cold() {
      if (firstStory) {
        await extractOne(0);
      } else {
        await extractAll();
      }
      return undefined;
    },
    async applySave(save) {
      const i = changedIndex(save);
      extraByComponent[i] += 1;
      fs.writeFileSync(project.componentPaths[i], componentSource(i, extraByComponent[i]));
      // Without this the re-extraction below is a cache hit, not a measurement.
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
      shape: options.shape,
    },
    saves: options.saves,
    coldLabel:
      options.shape === 'first-story'
        ? `1 of ${options.components} components`
        : `${options.components} components`,
    jsonOut: options.jsonOut,
    setup: () => createEngine(options),
  });
});
