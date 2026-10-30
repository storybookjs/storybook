/**
 * React specialization of core's generic {@link BaseComponentMetaManager}.
 *
 * The tsconfig discovery/matching, project-reference chains, file watching, and heap-pressure
 * recycling all live in `storybook/internal/component-meta`; this file contributes what is
 * React-specific: a {@link ComponentMetaProjectFactory} for each TypeScript API, React-flavored
 * inferred-project compiler options, and the {@link ComponentMetaManager.batchExtract} surface the
 * manifest generator and docgen provider drive.
 *
 * - The compiler API (TypeScript 5.9 and 6) gets one LanguageService per tsconfig, sharing one
 *   mtime-cached snapshot map and one document registry.
 * - The native API (TypeScript 7.1 and newer) gets one compiler process per manager, with one
 *   snapshot per tsconfig in it.
 */
import {
  ComponentMetaManager as BaseComponentMetaManager,
  type ComponentMetaProjectFactory,
  type FileSnapshotCache,
  type ProjectCommandLine,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';
import { logger } from 'storybook/internal/node-logger';

import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import { groupByToMap } from '../utils.ts';
import type { RawCompilerOptions } from 'typescript-native/sync';

import {
  type ComponentMetaTypeScript,
  type NativeTypeScriptModules,
  createNativeBackend,
} from '@storybook/component-meta-typescript';

import { ComponentMetaProject } from './ComponentMetaProject.ts';
import { NativeComponentMetaProject } from './native/NativeComponentMetaProject.ts';

// The manager's tsconfig-matching helpers are re-exported for existing consumers and tests.
export { isFileInDir, sortTSConfigs } from 'storybook/internal/component-meta';

const DEFAULT_INFERRED_OPTIONS: ts.CompilerOptions = {
  strict: true,
  esModuleInterop: true,
  allowJs: true,
  skipLibCheck: true,
};

type FsFileSnapshots = FileSnapshotCache<ts.IScriptSnapshot>;

type ManagedProject = ComponentMetaProject | NativeComponentMetaProject;

interface ReactProjectBackend {
  /** The filesystem probes core's manager runs during tsconfig discovery and watching. */
  fileSystem: {
    sys: { fileExists(path: string): boolean; directoryExists(path: string): boolean };
  };
  factory: ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>;
  fsFileSnapshots: FsFileSnapshots;
}

/**
 * Builds the compiler-API project factory plus the snapshot cache it closes over. The cache is
 * shared across every project the factory creates (Volar Kit checker pattern) and returned
 * separately so the manager can expose it to tests; it is cleared through the factory's `dispose`.
 */
function createCompilerApiBackend(typescript: typeof ts): ReactProjectBackend {
  // Adapted from:
  // https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L83
  const fsFileSnapshots: FsFileSnapshots = new Map();

  /**
   * Shared across every project so they reuse parsed+bound SourceFiles instead of each holding a
   * private copy of lib.d.ts, React's types and node_modules.
   *
   * Needs no cleanup of its own: disposing a LanguageService releases every SourceFile it holds, and
   * the registry drops an entry once its last reference goes, so a heap-pressure recycle empties it
   * as a side effect of disposing the projects.
   *
   * `useCaseSensitiveFileNames` defaults to `false`, which would lowercase the registry's path keys
   * on case-sensitive filesystems, so pass the host's value explicitly.
   */
  const documentRegistry = typescript.createDocumentRegistry(
    typescript.sys.useCaseSensitiveFileNames
  );

  const factory: ComponentMetaProjectFactory<ComponentMetaProject, ts.ParsedCommandLine> = {
    parseCommandLine: (tsconfig) =>
      parseTsconfigCommandLine<ts.ParsedCommandLine>(typescript, tsconfig),
    createConfiguredProject: (commandLine, tsconfig, getCommandLine) =>
      new ComponentMetaProject(
        typescript,
        commandLine,
        tsconfig,
        fsFileSnapshots,
        getCommandLine,
        documentRegistry
      ),
    createInferredProject: () =>
      new ComponentMetaProject(
        typescript,
        {
          options: {
            ...DEFAULT_INFERRED_OPTIONS,
            target: typescript.ScriptTarget.Latest,
            module: typescript.ModuleKind.ESNext,
            moduleResolution: typescript.ModuleResolutionKind.Bundler,
            jsx: typescript.JsxEmit.ReactJSX,
          },
          fileNames: [],
          errors: [],
        },
        undefined,
        fsFileSnapshots,
        undefined,
        documentRegistry
      ),
    dispose: () => fsFileSnapshots.clear(),
  };

  return {
    fileSystem: typescript,
    factory: factory as ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>,
    fsFileSnapshots,
  };
}

function createNativeApiBackend(modules: NativeTypeScriptModules): ReactProjectBackend {
  const { typescript, factory } = createNativeBackend(modules, NativeComponentMetaProject, {
    ...(DEFAULT_INFERRED_OPTIONS as RawCompilerOptions),
    target: modules.ast.ScriptTarget.Latest,
    module: modules.sync.ModuleKind.ESNext,
    moduleResolution: modules.sync.ModuleResolutionKind.Bundler,
    jsx: modules.sync.JsxEmit.ReactJSX,
  });
  return {
    fileSystem: typescript,
    factory: factory as ComponentMetaProjectFactory<ManagedProject, ProjectCommandLine>,
    fsFileSnapshots: new Map(),
  };
}

const createBackend = (typescript: ComponentMetaTypeScript): ReactProjectBackend => {
  if (!('api' in typescript)) {
    return createCompilerApiBackend(typescript);
  }
  return typescript.api === 'native'
    ? createNativeApiBackend(typescript.typescript)
    : createCompilerApiBackend(typescript.typescript);
};

export class ComponentMetaManager extends BaseComponentMetaManager<
  ManagedProject,
  ProjectCommandLine
> {
  /** Shared mtime-cached file snapshots of the compiler API, exposed for tests; owned by the factory. */
  readonly fsFileSnapshots: FsFileSnapshots;

  /**
   * `typescript` is the `typescript` module (compiler API) or the result of
   * `loadTypeScriptForDocgen`, which selects the native API for TypeScript 7.1 and newer.
   * `recycleHeapPressureRatio` is the fraction of the V8 heap limit at which the shared program(s)
   * are recycled; the memory regression gate passes `Infinity` to disable recycling and assert the
   * OOM still happens without the fix.
   */
  constructor(typescript: ComponentMetaTypeScript, recycleHeapPressureRatio?: number) {
    const { fileSystem, factory, fsFileSnapshots } = createBackend(typescript);
    super(fileSystem, factory, recycleHeapPressureRatio);
    this.fsFileSnapshots = fsFileSnapshots;
  }

  /**
   * Batch-extract component props across all entries, grouping by tsconfig project so each project
   * builds its TS program only once.
   */
  batchExtract(entries: StoryRef[]): void {
    const extractableEntries = entries.filter(
      (storyRef) => storyRef.component?.path && storyRef.component.importName
    );
    const byProject = groupByToMap(extractableEntries, (storyRef) =>
      this.getProjectForFile(storyRef.storyPath)
    );

    for (const [project, projectEntries] of byProject) {
      try {
        project.extractPropsFromStories(projectEntries);
      } catch (err) {
        logger.debug(`[reactComponentMeta] Batch extraction failed: ${err}`);
      }
    }

    this.recycleProjectsIfHeapPressured();
  }
}
