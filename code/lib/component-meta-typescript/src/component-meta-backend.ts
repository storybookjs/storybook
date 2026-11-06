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

export interface ComponentMetaBackend<
  Project extends ComponentMetaProjectBase,
  CommandLine extends ProjectCommandLine = ProjectCommandLine,
> {
  fileSystem: { sys: Pick<DocgenSystem, 'directoryExists' | 'fileExists'> };
  factory: ComponentMetaProjectFactory<Project, CommandLine>;
}

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
  return backend as unknown as ComponentMetaBackend<CompilerProject | NativeProject>;
}
