/**
 * React specialization of core's generic {@link BaseComponentMetaManager}.
 *
 * The tsconfig discovery/matching, project-reference chains, file watching, and heap-pressure
 * recycling all live in `storybook/internal/component-meta`; this file contributes what is
 * React-specific: a {@link ComponentMetaProjectFactory} for each TypeScript API, React-flavored
 * inferred-project compiler options, and the {@link ComponentMetaManager.batchExtract} surface the
 * manifest generator and docgen provider drive.
 */
import {
  ComponentMetaManager as BaseComponentMetaManager,
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
  type ComponentMetaBackend,
  type LoadedDocgenTypeScript,
  createComponentMetaBackend,
  createNativeBackend,
} from '@storybook/component-meta-typescript';

import { ComponentMetaProject } from './ComponentMetaProject.ts';
import { NativeComponentMetaProject } from './native/native-component-meta-project.ts';

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

/**
 * Builds the compiler-API project factory over a snapshot cache. The cache is shared across every
 * project the factory creates (Volar Kit checker pattern) and owned by the manager, which exposes it
 * to tests; it is cleared through the factory's `dispose`.
 */
function createCompilerApiBackend(
  typescript: typeof ts,
  fsFileSnapshots: FsFileSnapshots
): ComponentMetaBackend<ComponentMetaProject, ts.ParsedCommandLine> {
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

  const factory: ComponentMetaBackend<ComponentMetaProject, ts.ParsedCommandLine>['factory'] = {
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

  return { fileSystem: typescript, factory };
}

export class ComponentMetaManager extends BaseComponentMetaManager<
  ManagedProject,
  ProjectCommandLine
> {
  // Shared mtime-cached file snapshots of the compiler API, exposed for tests; the factory clears them.
  readonly fsFileSnapshots: FsFileSnapshots;

  /**
   * `recycleHeapPressureRatio` is the fraction of the V8 heap limit at which the shared program(s)
   * are recycled; the memory regression gate passes `Infinity` to disable recycling and assert the
   * OOM still happens without the fix.
   */
  constructor(typescript: LoadedDocgenTypeScript, recycleHeapPressureRatio?: number) {
    // Adapted from:
    // https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L83
    const fsFileSnapshots: FsFileSnapshots = new Map();
    const { fileSystem, factory } = createComponentMetaBackend(typescript, {
      compiler: (compilerApi) => createCompilerApiBackend(compilerApi, fsFileSnapshots),
      native: (modules) =>
        createNativeBackend(modules, NativeComponentMetaProject, {
          ...(DEFAULT_INFERRED_OPTIONS as RawCompilerOptions),
          target: modules.ast.ScriptTarget.Latest,
          module: modules.sync.ModuleKind.ESNext,
          moduleResolution: modules.sync.ModuleResolutionKind.Bundler,
          jsx: modules.sync.JsxEmit.ReactJSX,
        }),
    });
    super(fileSystem, factory, recycleHeapPressureRatio);
    this.fsFileSnapshots = fsFileSnapshots;
  }

  /**
   * Batch-extract component props across all entries, grouping by tsconfig project so each project
   * builds its TS program only once.
   *
   * `batchFiles` holds the files of a larger batch that these entries are part of, from
   * {@link groupFilesByProject}. A project gets its files before its first extraction, and its entry
   * is then removed from the map.
   */
  batchExtract(entries: StoryRef[], batchFiles?: Map<ManagedProject, string[]>): void {
    const byProject = groupByToMap(entries.filter(isExtractable), (storyRef) =>
      this.getProjectForFile(storyRef.storyPath)
    );

    for (const [project, projectEntries] of byProject) {
      this.addBatchFiles(project, batchFiles);
      try {
        project.extractPropsFromStories(projectEntries);
      } catch (err) {
        logger.debug(`[reactComponentMeta] Batch extraction failed: ${err}`);
      }
    }

    // The batch's projects are disposed, and holding them keeps their language service hosts.
    if (this.recycleProjectsIfHeapPressured()) {
      batchFiles?.clear();
    }
  }

  // Not before the project's first extraction: the projects share their source files, and a
  // program built between this project's program and its first type check leaves imports of those
  // files unresolved.
  private addBatchFiles(
    project: ManagedProject,
    batchFiles: Map<ManagedProject, string[]> | undefined
  ): void {
    const files = batchFiles?.get(project) ?? [];
    batchFiles?.delete(project);
    try {
      project.ensureFiles(files);
    } catch (err) {
      // The native TypeScript backend can throw here. The extraction then adds its own files.
      logger.debug(`[reactComponentMeta] Adding the batch files failed: ${err}`);
    }
  }
}

export const isExtractable = (
  storyRef: StoryRef
): storyRef is StoryRef & { component: { path: string; importName: string } } =>
  !!storyRef.component?.path && !!storyRef.component.importName;
