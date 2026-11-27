// The Svelte flavour of the workspace generator in `./workspace.ts`: runes components whose
// `$props()` are typed by the workspace's props chain, plus the Svelte runtime types they import.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'pathe';

import {
  type GeneratedWorkspaceProject,
  type WorkspaceComponent,
  type WorkspaceFramework,
  type WorkspaceGenerateOptions,
  generateWorkspaceProject,
  grownPropsType,
} from './workspace.ts';

const require = createRequire(import.meta.url);

// The svelte2tsx output of every component imports `svelte`, so its types must resolve.
function copySvelteNodeModules(projectDir: string): void {
  const dest = path.join(projectDir, 'node_modules');
  fs.mkdirSync(path.join(dest, '@types'), { recursive: true });
  fs.cpSync(path.dirname(require.resolve('svelte/package.json')), path.join(dest, 'svelte'), {
    recursive: true,
    dereference: true,
  });
  const svelteRequire = createRequire(require.resolve('svelte/package.json'));
  fs.cpSync(
    path.dirname(svelteRequire.resolve('@types/estree/package.json')),
    path.join(dest, '@types', 'estree'),
    { recursive: true, dereference: true }
  );
}

// A component's source. `extraProps` grows the props type by one optional prop per save, so a
// simulated save genuinely changes the component's type.
export function svelteComponentSource(p: number, i: number, extraProps: number): string {
  const propsType = grownPropsType(p, extraProps);
  return `<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import type { Pkg${p}Props } from '../types';

  let { id, ...rest }: ${propsType} & Omit<HTMLButtonAttributes, 'id'> = $props();
</script>

<button data-comp="c${p}x${i}" {...rest}>{id}</button>
`;
}

const SVELTE_COMPONENT: WorkspaceComponent = { extension: 'svelte', source: svelteComponentSource };

export function generateSvelteProject(
  options: WorkspaceGenerateOptions
): GeneratedWorkspaceProject {
  return generateWorkspaceProject(options, SVELTE_COMPONENT, copySvelteNodeModules);
}

export const SVELTE_FRAMEWORK: WorkspaceFramework = {
  generate: generateSvelteProject,
  componentSource: svelteComponentSource,
};
