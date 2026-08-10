// Series harness for the in-process Angular analyzer, over the same generated project as the
// compodoc engine so the angular control pair compares the two engines directly.
//
// Run from code/lib/docgen-harness:
//   node --expose-gc src/perf/docgen-perf/engines/angular-component-meta.ts \
//     --components 100 --props 8 --saves 10 --json /tmp/result.json
import * as fs from 'node:fs';
import * as path from 'node:path';

import ts from 'typescript';
import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import {
  type GeneratedAngularProject,
  angularComponentSource,
  generateAngularProject,
} from '../generators/angular.ts';
import { countMembers } from './compodoc-doc.ts';

type AnalyzerModule = typeof import('@storybook/angular-cm');
type Manager = InstanceType<AnalyzerModule['AngularComponentMetaManager']>;

// The analyzer resolves through built output twice over, so a missing dist makes Node name a path
// the harness never mentioned - without this the message omits the one thing to do: compile first.
async function loadAnalyzer(): Promise<AnalyzerModule> {
  try {
    return await import('@storybook/angular-cm');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/[/\\]dist[/\\]/.test(message)) {
      throw new Error(
        `the angular-component-meta engine needs built output that is missing. Run ` +
          `\`yarn nx compile angular-cm\` (or \`yarn nx compile core\` when the named path ` +
          `is storybook's dist) and try again.\n  cause: ${message}`
      );
    }
    throw err;
  }
}

const OPTIONS = {
  components: { type: 'string' },
  props: { type: 'string' },
  saves: { type: 'string' },
  out: { type: 'string' },
  json: { type: 'string' },
} as const;

const SCHEMA = z.object({
  components: countOption(100),
  props: countOption(8),
  saves: countOption(10),
  outDir: z
    .string()
    .default(path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'angular-component-meta', 'project')),
  jsonOut: z.string().optional(),
});

type Options = z.infer<typeof SCHEMA>;

function parseOptions(argv: string[]): Options {
  return parseHarnessOptions<Options>(argv, OPTIONS, SCHEMA, (values) => ({
    ...values,
    outDir: values.out,
    jsonOut: values.json,
  }));
}

// Counted through the same function as compodoc's `documentation.json`, so both sides of the pair
// count members by one rule.
function extractOne(manager: Manager, project: GeneratedAngularProject, index: number): number {
  const componentPath = project.componentPaths[index];
  const result = manager.extractComponentMeta(componentPath, {
    exportName: `Comp${index}Component`,
  });
  if (!result) {
    throw new Error(`no component meta extracted from ${componentPath}`);
  }
  const { entry } = result;
  // Only component/directive records carry the four member arrays; anything else counting as zero
  // would report a broken analyzer as a fast one.
  if (entry.type !== 'component' && entry.type !== 'directive') {
    throw new Error(`expected a component entry for ${componentPath}, got "${entry.type}"`);
  }
  const { members } = countMembers([entry]);
  if (members === 0) {
    throw new Error(`angular-component-meta documented zero members for ${componentPath}`);
  }
  return members;
}

async function createEngine(options: Options): Promise<SeriesEngine> {
  const analyzer = await loadAnalyzer();
  const genStart = Date.now();
  const project = generateAngularProject({
    outDir: options.outDir,
    components: options.components,
    props: options.props,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  const extraProps = new Array<number>(options.components).fill(0);
  let manager: Manager | undefined;
  let measured = 0;

  return {
    async cold() {
      manager = new analyzer.AngularComponentMetaManager(ts);
      let members = 0;
      for (let index = 0; index < project.componentPaths.length; index++) {
        members += extractOne(manager, project, index);
      }
      return members;
    },
    async applySave(save) {
      // The same mutation the compodoc engine's warm run applies to component 0 - the touched
      // component gains one extra input - walked round-robin, which is sound here because the cold
      // pass documented every component (see PERF-METHODOLOGY.md on save targets).
      const index = (save - 1) % project.componentPaths.length;
      extraProps[index] += 1;
      const filePath = project.componentPaths[index];
      fs.writeFileSync(filePath, angularComponentSource(index, options.props + extraProps[index]));
      manager!.onFilesChanged([{ filePath, type: 'changed' }]);
      measured = index;
    },
    async reextract() {
      return extractOne(manager!, project, measured);
    },
    dispose() {
      manager?.dispose();
    },
  };
}

harnessMain(async () => {
  const options = parseOptions(process.argv.slice(2));
  await runSeriesHarness({
    title: 'angular-component-meta harness',
    options,
    banner: { components: options.components, props: options.props, saves: options.saves },
    saves: options.saves,
    coldLabel: `${options.components} components, manager creation included`,
    jsonOut: options.jsonOut,
    setup: async () => createEngine(options),
  });
});
