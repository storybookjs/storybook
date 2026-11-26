import {
  ComponentMetaManager,
  type ProjectCommandLine,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';

import type * as ts from 'typescript';
import type { RawCompilerOptions } from 'typescript-native/sync';
import {
  type ComponentMetaBackend,
  type LoadedDocgenTypeScript,
  createComponentMetaBackend,
  createNativeBackend,
} from '@storybook/component-meta-typescript';

import type { ComponentNames } from './extract-component.ts';
import { NativeAngularComponentMetaProject } from './native-project.ts';
import { AngularComponentMetaProject, type FsFileSnapshots } from './project.ts';
import type { AngularComponentMetaResult } from './types.ts';

type ManagedProject = AngularComponentMetaProject | NativeAngularComponentMetaProject;

// Permissive defaults for files no tsconfig claims, which still use legacy decorators.
const INFERRED_OPTIONS = {
  strict: false,
  allowJs: true,
  skipLibCheck: true,
  experimentalDecorators: true,
} as const;

function createCompilerApiBackend(
  typescript: typeof ts
): ComponentMetaBackend<AngularComponentMetaProject, ts.ParsedCommandLine> {
  const fsFileSnapshots: FsFileSnapshots = new Map();

  // Shared so projects reuse parsed SourceFiles instead of each holding a private copy of lib.d.ts.
  const documentRegistry = typescript.createDocumentRegistry(
    typescript.sys.useCaseSensitiveFileNames
  );

  const factory: ComponentMetaBackend<
    AngularComponentMetaProject,
    ts.ParsedCommandLine
  >['factory'] = {
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

  return { fileSystem: typescript, factory };
}

/**
 * Extract argTypes-ready metadata for Angular components straight from their TypeScript sources.
 *
 * Keeps one warm program per matched tsconfig, so bracket the manager's lifetime with
 * `startWatching()`/`dispose()`. `typescript` is the result of `loadDocgenTypeScript`, which selects
 * the native API for TypeScript 7.1 and newer.
 */
export class AngularComponentMetaManager extends ComponentMetaManager<
  ManagedProject,
  ProjectCommandLine
> {
  constructor(typescript: LoadedDocgenTypeScript) {
    const { fileSystem, factory } = createComponentMetaBackend(typescript, {
      compiler: createCompilerApiBackend,
      native: (modules) =>
        createNativeBackend(modules, NativeAngularComponentMetaProject, {
          ...(INFERRED_OPTIONS as RawCompilerOptions),
          target: modules.ast.ScriptTarget.Latest,
          module: modules.sync.ModuleKind.ESNext,
          moduleResolution: modules.sync.ModuleResolutionKind.Bundler,
        }),
    });
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
