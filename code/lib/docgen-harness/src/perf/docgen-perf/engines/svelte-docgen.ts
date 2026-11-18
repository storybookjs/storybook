// Series harness for Svelte's svelte2tsx docgen, in the two shapes it runs:
//
//   legacy          `generateDocgen` with one cache, as builder docgen runs it: a `ts.Program` built
//                   per extraction, reusing the previous one, with every source file re-stat'ed to
//                   find what changed. A save needs no invalidation step, since those mtimes find it.
//   component-meta  The docgen server's `SvelteComponentMetaManager`: one program and checker per
//                   tsconfig, rebuilt only when a file event arrives. A save is reported to it the
//                   way its file watcher would, outside the timed path.
//
// Both load the renderer's source, so neither side measures a different build of the same code.
//
// Run from code/lib/docgen-harness:
//   node --expose-gc src/perf/docgen-perf/engines/svelte-docgen.ts --engine component-meta \
//     --scenario workspace --packages 4 --components-per-package 10 --heavy-lib --json /tmp/result.json
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import { dirname, join } from 'pathe';
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
type ComponentMetaModule =
  typeof import('../../../../../../renderers/svelte/src/docgen/component-docgen/component-meta/svelte-project-manager.ts');
type Docgen = ReturnType<GenerateDocgenModule['generateDocgen']>;

const ENGINES = ['legacy', 'component-meta'] as const;
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

// Anchored on the resolved package, like the React harnesses' renderer loader.
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
  const { SvelteComponentMetaManager } = await loadRendererModule<ComponentMetaModule>(
    'docgen/component-docgen/component-meta/svelte-project-manager.ts'
  );

  let extract: (componentPath: string, documentationSource: string) => Docgen;
  let reportSave: (filePath: string) => void = () => {};
  if (options.engine === 'component-meta') {
    let componentMetaManager:
      | InstanceType<ComponentMetaModule['SvelteComponentMetaManager']>
      | undefined;
    extract = (componentPath, documentationSource) => {
      // Created inside the cold pass: the docgen server creates it on its first request.
      componentMetaManager ??= new SvelteComponentMetaManager();
      return componentMetaManager.generateDocgen(componentPath, {
        server: true,
        documentationSource,
      });
    };
    reportSave = (filePath) =>
      componentMetaManager?.onFilesChanged([{ filePath, type: 'changed' }]);
  } else {
    const cache = createDocgenCache();
    extract = (componentPath, documentationSource) =>
      generateDocgen(componentPath, cache, { server: true, documentationSource });
  }

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
      reportSave(mutation.filePath);
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
