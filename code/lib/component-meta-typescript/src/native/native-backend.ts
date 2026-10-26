import type { ComponentMetaProjectFactory } from 'storybook/internal/component-meta';

import type { API, RawCompilerOptions } from 'typescript-native/sync';

import type { NativeCommandLine, NativeProject } from './NativeProject.ts';
import {
  type NativeDocgenTypeScript,
  type NativeTypeScriptModules,
  createNativeDocgenTypeScript,
} from './native-typescript.ts';

type NativeProjectClass<Project extends NativeProject> = new (
  api: API,
  typescript: NativeDocgenTypeScript,
  commandLine: NativeCommandLine,
  configFileName: string | undefined,
  getCommandLine?: () => NativeCommandLine
) => Project;

/**
 * Build a component-meta manager's native backend: one compiler process for all of its projects,
 * closed with the factory. A heap-pressure recycle disposes the projects' snapshots, which releases
 * their programs in that process.
 */
export function createNativeBackend<Project extends NativeProject>(
  modules: NativeTypeScriptModules,
  ProjectClass: NativeProjectClass<Project>,
  inferredOptions: RawCompilerOptions
): {
  typescript: NativeDocgenTypeScript;
  factory: ComponentMetaProjectFactory<Project, NativeCommandLine>;
} {
  const api = new modules.sync.API({ cwd: process.cwd() });
  const typescript = createNativeDocgenTypeScript(modules, api);
  return {
    typescript,
    factory: {
      parseCommandLine: (tsconfig) => {
        const { fileNames, options, projectReferences } = api.parseConfigFile(tsconfig);
        return {
          fileNames: [...fileNames],
          options: options as RawCompilerOptions,
          projectReferences,
        };
      },
      createConfiguredProject: (commandLine, tsconfig, getCommandLine) =>
        new ProjectClass(api, typescript, commandLine, tsconfig, getCommandLine),
      createInferredProject: () =>
        new ProjectClass(api, typescript, { fileNames: [], options: inferredOptions }, undefined),
      dispose: () => api.close(),
    },
  };
}
