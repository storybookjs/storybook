/**
 * Series harness for `@storybook/angular-cm`, the analyzer Angular's docgen server runs, on the
 * compiler API of this package's `typescript` (6) or the native API of the `typescript-native`
 * alias (7.1). Manager creation runs inside the cold pass, since it is part of first-extraction
 * cost. A save rewrites one component with one more input; the manager notices through its mtime
 * check, as the docgen server, which runs no watcher, does.
 *
 * Run from code/lib/docgen-harness:
 *   node --expose-gc --import jiti/register src/perf/docgen-perf/engines/angular-cm.ts \
 *     --components 100 --props 8 --saves 10 --typescript native --json /tmp/result.json
 */
import * as fs from 'node:fs';
import * as path from 'pathe';

import ts from 'typescript';
import { z } from 'zod';

import { AngularComponentMetaManager } from '@storybook/angular-cm';
import type { ComponentMetaTypeScript } from '@storybook/component-meta-typescript';

import { countOption, parseHarnessOptions, positiveCountOption } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import { type SeriesEngine, harnessMain, runSeriesHarness } from '../../docgen-shared/series.ts';
import { angularComponentSource, generateAngularProject } from '../generators/angular.ts';

const OPTIONS = {
  components: { type: 'string' },
  props: { type: 'string' },
  saves: { type: 'string' },
  typescript: { type: 'string' },
  out: { type: 'string' },
  json: { type: 'string' },
} as const;

const SCHEMA = z.object({
  components: positiveCountOption(100),
  props: countOption(8),
  saves: countOption(10),
  typescript: z.enum(['compiler', 'native']).default('compiler'),
  out: z.string().optional(),
  json: z.string().optional(),
});

type Options = z.infer<typeof SCHEMA>;

async function loadTypeScript(api: Options['typescript']): Promise<ComponentMetaTypeScript> {
  if (api === 'compiler') {
    return ts;
  }
  return {
    api: 'native',
    typescript: {
      sync: await import('typescript-native/sync'),
      ast: await import('typescript-native/ast'),
      factory: await import('typescript-native/ast/factory'),
    },
  };
}

function extractOne(manager: AngularComponentMetaManager, filePath: string, i: number): number {
  const entry = manager.extractComponentMeta(filePath, { exportName: `Comp${i}Component` })?.entry;
  if (entry?.type !== 'component' || entry.inputsClass.length === 0) {
    throw new Error(`angular-cm extracted no inputs from ${filePath}`);
  }
  return entry.inputsClass.length + entry.outputsClass.length;
}

async function createEngine(options: Options): Promise<SeriesEngine> {
  const project = generateAngularProject({
    outDir: options.out ?? path.join(SANDBOX_DIRECTORY, 'docgen-perf', 'angular-cm', 'project'),
    components: options.components,
    props: options.props,
  });
  const typescript = await loadTypeScript(options.typescript);
  let manager: AngularComponentMetaManager | undefined;
  let measured = 0;

  return {
    async cold() {
      manager = new AngularComponentMetaManager(typescript);
      let members = 0;
      for (const [i, filePath] of project.componentPaths.entries()) {
        members += extractOne(manager, filePath, i);
      }
      return members;
    },
    async applySave(save) {
      measured = save % project.componentPaths.length;
      const filePath = project.componentPaths[measured];
      fs.writeFileSync(filePath, angularComponentSource(measured, options.props + 1 + (save % 2)));
      // Moved past any earlier read, so a save within the same millisecond still counts as an edit.
      const future = new Date(Date.now() + 1000 * (save + 1));
      fs.utimesSync(filePath, future, future);
    },
    async reextract() {
      return extractOne(manager!, project.componentPaths[measured], measured);
    },
    dispose() {
      manager?.dispose();
    },
  };
}

harnessMain(async () => {
  const options = parseHarnessOptions<Options>(process.argv.slice(2), OPTIONS, SCHEMA);
  await runSeriesHarness({
    title: `angular-cm harness (${options.typescript} API)`,
    options,
    saves: options.saves,
    coldLabel: `${options.components} components, manager creation included`,
    jsonOut: options.json,
    setup: () => createEngine(options),
  });
});
