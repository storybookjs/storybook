/**
 * Series harness for Svelte's svelte2tsx docgen:
 *
 *   legacy    `generateDocgen` with one cache, as builder docgen and the docgen server run it: a
 *             `ts.Program` built per extraction, reusing the previous one, with every source file
 *             re-stat'ed to find what changed. A save needs no invalidation step, since those mtimes
 *             find it.
 *
 * It loads the renderer's source, like the React harnesses.
 *
 * Run from code/lib/docgen-harness:
 *   node --expose-gc src/perf/docgen-perf/engines/svelte-docgen.ts --engine legacy \
 *     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { parseHarnessOptions } from '../../docgen-shared/args.ts';
import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import { SVELTE_FRAMEWORK } from '../generators/svelte.ts';
import {
  WORKSPACE_OPTIONS,
  WORKSPACE_SCHEMA,
  type WorkspaceHarnessOptions,
  type WorkspaceOptionsInput,
  setUpWorkspaceScenario,
  workspaceBanner,
  workspaceOutDir,
  workspaceToInput,
} from './workspace-scenario.ts';

type GenerateDocgenModule =
  typeof import('../../../../../../renderers/svelte/src/docgen/component-docgen/svelte2tsx/generate-docgen.ts');
type Docgen = ReturnType<GenerateDocgenModule['generateDocgen']>;

const ENGINES = ['legacy'] as const;
type SvelteEngine = (typeof ENGINES)[number];

const SCHEMA = WORKSPACE_SCHEMA.extend({ engine: z.enum(ENGINES) });

function parseOptions(argv: string[]): WorkspaceHarnessOptions & { engine: SvelteEngine } {
  const parsed = parseHarnessOptions<WorkspaceOptionsInput & { engine: SvelteEngine }>(
    argv,
    { ...WORKSPACE_OPTIONS, engine: { type: 'string' } },
    SCHEMA,
    workspaceToInput
  );
  return { ...parsed, outDir: parsed.outDir ?? workspaceOutDir(`svelte-${parsed.engine}`) };
}

const require = createRequire(import.meta.url);

/** Anchored on the resolved package, like the React harnesses' renderer loader. */
async function loadRendererModule<T>(relativePath: string): Promise<T> {
  const packageRoot = dirname(require.resolve('@storybook/svelte/package.json'));
  return (await import(pathToFileURL(join(packageRoot, 'src', relativePath)).href)) as T;
}

async function createEngine(
  options: WorkspaceHarnessOptions & { engine: SvelteEngine }
): Promise<SeriesEngine> {
  const scenario = setUpWorkspaceScenario(options, SVELTE_FRAMEWORK);
  const { createDocgenCache, generateDocgen } = await loadRendererModule<GenerateDocgenModule>(
    'docgen/component-docgen/svelte2tsx/generate-docgen.ts'
  );
  const cache = createDocgenCache();
  const extract = (componentPath: string, documentationSource: string): Docgen =>
    generateDocgen(componentPath, cache, { server: true, documentationSource });

  let measuredPath = scenario.targetPaths[0];
  const extractOne = (componentPath: string): number => {
    const docgen = extract(componentPath, fs.readFileSync(componentPath, 'utf8'));
    if (docgen.props.length === 0) {
      throw new Error(`svelte2tsx docgen returned zero props for ${componentPath}`);
    }
    return docgen.props.length + (docgen.events?.length ?? 0) + (docgen.slots?.length ?? 0);
  };

  return {
    async cold() {
      let members = 0;
      for (const componentPath of scenario.targetPaths) {
        members += extractOne(componentPath);
      }
      return members;
    },
    async applySave(save) {
      const mutation = scenario.mutationFor(save);
      fs.writeFileSync(mutation.filePath, mutation.content);
      measuredPath = mutation.measuredPath;
    },
    async reextract() {
      return extractOne(measuredPath);
    },
  };
}

harnessMain(async () => {
  const options = parseOptions(process.argv.slice(2));
  await runSeriesHarness({
    title: `svelte-${options.engine} harness (${options.scenario})`,
    options,
    banner: workspaceBanner(options),
    saves: options.saves,
    coldLabel: `${options.componentsPerPackage} components`,
    jsonOut: options.jsonOut,
    setup: async () => createEngine(options),
  });
});
