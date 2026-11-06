import type { API, RawCompilerOptions } from 'typescript-native/sync';

import type { ComponentMetaBackend } from '../component-meta-backend.ts';
import type { NativeCommandLine, NativeProject } from './native-project.ts';
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

export function createNativeBackend<Project extends NativeProject>(
  modules: NativeTypeScriptModules,
  ProjectClass: NativeProjectClass<Project>,
  inferredOptions: RawCompilerOptions
): ComponentMetaBackend<Project, NativeCommandLine> {
  const api = new modules.sync.API({ cwd: process.cwd() });
  const typescript = createNativeDocgenTypeScript(modules, api);
  return {
    fileSystem: typescript,
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
