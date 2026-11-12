// The Svelte flavour of the workspace generator in `./workspace.ts`: runes components whose
// `$props()` are typed by the workspace's props chain, plus the Svelte runtime types they import.
import * as path from 'pathe';

import { copyPackages } from '../../docgen-shared/copy-packages.ts';
import {
  type GeneratedWorkspaceProject,
  type WorkspaceComponent,
  type WorkspaceFramework,
  type WorkspaceGenerateOptions,
  generateWorkspaceProject,
  grownPropsType,
} from './workspace.ts';

// The svelte2tsx output of every component imports `svelte`, so its types must resolve.
function copySvelteNodeModules(projectDir: string): void {
  copyPackages(path.join(projectDir, 'node_modules'), {
    svelte: { '@types/estree': {}, 'magic-string': {} },
  });
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
