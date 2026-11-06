import type {
  ComponentMetaProjectBase,
  ComponentMetaProjectFactory,
  ProjectCommandLine,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';

import type { DocgenSystem } from './docgen-typescript.ts';
import type { LoadedDocgenTypeScript } from './load-docgen-typescript.ts';
import type { NativeCommandLine } from './native/native-project.ts';
import type { NativeTypeScriptModules } from './native/native-typescript.ts';

// What a component-meta manager runs on: the filesystem probes core's manager runs during tsconfig
// discovery and watching, and the factory of its projects.
export interface ComponentMetaBackend<
  Project extends ComponentMetaProjectBase,
  CommandLine extends ProjectCommandLine = ProjectCommandLine,
> {
  fileSystem: { sys: Pick<DocgenSystem, 'directoryExists' | 'fileExists'> };
  factory: ComponentMetaProjectFactory<Project, CommandLine>;
}

// Create a component-meta manager's backend for the API that the loaded TypeScript offers.
export function createComponentMetaBackend<
  CompilerProject extends ComponentMetaProjectBase,
  NativeProject extends ComponentMetaProjectBase,
>(
  loaded: LoadedDocgenTypeScript,
  create: {
    compiler: (
      typescript: typeof ts
    ) => ComponentMetaBackend<CompilerProject, ts.ParsedCommandLine>;
    native: (
      modules: NativeTypeScriptModules
    ) => ComponentMetaBackend<NativeProject, NativeCommandLine>;
  }
): ComponentMetaBackend<CompilerProject | NativeProject> {
  const backend =
    loaded.api === 'native' ? create.native(loaded.typescript) : create.compiler(loaded.typescript);
  // Core's manager passes the command lines a factory parses back to that factory only.
  return backend as unknown as ComponentMetaBackend<CompilerProject | NativeProject>;
}
