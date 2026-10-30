import {
  ComponentMetaManager,
  type ComponentMetaProjectFactory,
  type ProjectCommandLine,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';

import type * as ts from 'typescript';
import type { RawCompilerOptions } from 'typescript-native/sync';
import {
  type ComponentMetaTypeScript,
  type NativeTypeScriptModules,
  createNativeBackend,
} from '@storybook/component-meta-typescript';

import type { ComponentNames } from './extract-component.ts';
import { NativeAngularComponentMetaProject } from './native-project.ts';
import { AngularComponentMetaProject, type FsFileSnapshots } from './project.ts';
import type { AngularComponentMetaResult } from './types.ts';

type ManagedProject = AngularComponentMetaProject | NativeAngularComponentMetaProject;

interface AngularProjectBackend {
  fileSystem: {
    sys: { fileExists(path: string): boolean; directoryExists(path: string): boolean };
  };
  factory: ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>;
}

// Permissive defaults for files no tsconfig claims, which still use legacy decorators.
const INFERRED_OPTIONS = {
  strict: false,
  allowJs: true,
  skipLibCheck: true,
  experimentalDecorators: true,
} as const;

function createCompilerApiBackend(typescript: typeof ts): AngularProjectBackend {
  const fsFileSnapshots: FsFileSnapshots = new Map();

  // Shared so projects reuse parsed SourceFiles instead of each holding a private copy of lib.d.ts.
  const documentRegistry = typescript.createDocumentRegistry(
    typescript.sys.useCaseSensitiveFileNames
  );

  const factory: ComponentMetaProjectFactory<AngularComponentMetaProject, ts.ParsedCommandLine> = {
    parseCommandLine: (tsconfig) =>
      parseTsconfigCommandLine<ts.ParsedCommandLine>(typescript, tsconfig),
    createConfiguredProject: (commandLine, tsconfig, getCommandLine) =>
      new AngularComponentMetaProject(
        typescript,
        commandLine,
        tsconfig,
        fsFileSnapshots,
        getCommandLine,
        documentRegistry
      ),
    createInferredProject: () =>
      new AngularComponentMetaProject(
        typescript,
        {
          options: {
            ...INFERRED_OPTIONS,
            target: typescript.ScriptTarget.Latest,
            module: typescript.ModuleKind.ESNext,
            moduleResolution: typescript.ModuleResolutionKind.Bundler,
          },
          fileNames: [],
          errors: [],
        },
        undefined,
        fsFileSnapshots,
        undefined,
        documentRegistry
      ),
    // The snapshots hold every file's source text and are shared across projects, so they outlive
    // any single one and have to be dropped alongside them.
    recycle: () => fsFileSnapshots.clear(),
    dispose: () => fsFileSnapshots.clear(),
  };

  return {
    fileSystem: typescript,
    factory: factory as ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>,
  };
}

function createNativeApiBackend(modules: NativeTypeScriptModules): AngularProjectBackend {
  const { typescript, factory } = createNativeBackend(modules, NativeAngularComponentMetaProject, {
    ...(INFERRED_OPTIONS as RawCompilerOptions),
    target: modules.ast.ScriptTarget.Latest,
    module: modules.sync.ModuleKind.ESNext,
    moduleResolution: modules.sync.ModuleResolutionKind.Bundler,
  });
  return {
    fileSystem: typescript,
    factory: factory as ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>,
  };
}

const createBackend = (typescript: ComponentMetaTypeScript): AngularProjectBackend => {
  if (!('api' in typescript)) {
    return createCompilerApiBackend(typescript);
  }
  return typescript.api === 'native'
    ? createNativeApiBackend(typescript.typescript)
    : createCompilerApiBackend(typescript.typescript);
};

/**
 * Extract argTypes-ready metadata for Angular components straight from their TypeScript sources.
 *
 * Keeps one warm program per matched tsconfig, so bracket the manager's lifetime with
 * `startWatching()`/`dispose()`. `typescript` is the `typescript` module (compiler API) or the
 * result of `loadTypeScriptForDocgen`, which selects the native API for TypeScript 7.1 and newer.
 */
export class AngularComponentMetaManager extends ComponentMetaManager<
  ManagedProject,
  ProjectCommandLine
> {
  constructor(typescript: ComponentMetaTypeScript) {
    const { fileSystem, factory } = createBackend(typescript);
    super(fileSystem, factory);
  }

  /**
   * Extract the metadata for one component, or `undefined` when neither the file nor its
   * re-export target declares a class matching `names`.
   */
  extractComponentMeta(
    componentPath: string,
    names: ComponentNames
  ): AngularComponentMetaResult | undefined {
    return this.getProjectForFile(componentPath).extract(componentPath, names);
  }

  /** Release cached projects under heap pressure; with no batch surface, call it per payload. */
  recycleIfHeapPressured(): void {
    this.recycleProjectsIfHeapPressured();
  }
}
