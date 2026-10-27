// The Vue flavour of the workspace generator in `./workspace.ts`: `.vue` SFCs typed by the
// workspace's props chain, plus the Vue runtime types the checker needs.
//
// Run directly, from code/lib/docgen-harness (--out defaults into the sandbox directory):
//   node src/perf/docgen-perf/generators/vue.ts --packages 4 --components-per-package 10
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type GeneratedWorkspaceProject,
  type WorkspaceComponent,
  type WorkspaceFramework,
  type WorkspaceGenerateOptions,
  type WorkspaceProjectFiles,
  type WorkspaceProjectShape,
  generateWorkspaceProject,
  grownPropsType,
  workspaceProjectFiles,
} from './workspace.ts';

const require = createRequire(import.meta.url);

// Copy the minimal node_modules packages the checker needs for Vue type resolution.
function copyVueNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  const rootNodeModules = path.resolve(require.resolve('vue/package.json'), '../..');
  fs.mkdirSync(path.join(dest, '@vue'), { recursive: true });

  for (const pkg of ['vue', 'csstype']) {
    fs.cpSync(path.join(rootNodeModules, pkg), path.join(dest, pkg), {
      recursive: true,
      dereference: true,
    });
  }
  for (const pkg of ['runtime-core', 'runtime-dom', 'shared', 'reactivity', 'compiler-dom']) {
    fs.cpSync(path.join(rootNodeModules, '@vue', pkg), path.join(dest, '@vue', pkg), {
      recursive: true,
      dereference: true,
    });
  }
}

// An SFC's source. `extraProps` grows the intersection type by one optional prop per save, so a
// simulated save genuinely changes the component's type.
export function vueComponentSource(p: number, i: number, extraProps: number): string {
  const propsType = grownPropsType(p, extraProps);
  return `<script setup lang="ts">
import type { Pkg${p}Props } from '../types';

const props = defineProps<${propsType}>();
</script>

<template>
  <div :data-comp="'c${p}x${i}'">{{ props.id }}</div>
</template>
`;
}

export const VUE_COMPONENT: WorkspaceComponent = { extension: 'vue', source: vueComponentSource };

export function vueProjectFiles(options: WorkspaceProjectShape): WorkspaceProjectFiles {
  return workspaceProjectFiles(options, VUE_COMPONENT);
}

export function generateVueProject(options: WorkspaceGenerateOptions): GeneratedWorkspaceProject {
  return generateWorkspaceProject(options, VUE_COMPONENT, copyVueNodeModules);
}

export const VUE_FRAMEWORK: WorkspaceFramework = {
  generate: generateVueProject,
  componentSource: vueComponentSource,
};

function parseOptions(argv: string[]): WorkspaceGenerateOptions {
  return parseHarnessOptions<WorkspaceGenerateOptions>(
    argv,
    {
      out: { type: 'string' },
      packages: { type: 'string' },
      'components-per-package': { type: 'string' },
      'chain-depth': { type: 'string' },
      'fan-out': { type: 'string' },
      'heavy-lib': { type: 'boolean' },
    } as const,
    z.object({
      outDir: z.string().default(path.join(SANDBOX_DIRECTORY, 'docgen-perf-vue')),
      packages: countOption(4),
      componentsPerPackage: countOption(10),
      chainDepth: countOption(3),
      fanOut: countOption(4),
      heavyLib: z.boolean().default(false),
    }),
    (values) => ({ ...values, outDir: values.out })
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseOptions(process.argv.slice(2));
  const start = Date.now();
  const result = generateVueProject(options);
  console.log(
    `Generated ${options.packages}×${options.componentsPerPackage} Vue components ` +
      `into ${result.outDir} in ${Date.now() - start}ms`
  );
}
