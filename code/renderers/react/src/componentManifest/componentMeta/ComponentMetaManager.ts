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

  private batch: StoryRef[] = [];
  // The batch's files that each project has yet to receive.
  private batchFiles: Map<ManagedProject, string[]> | undefined;

  /**
   * Announce every ref the coming `batchExtract` calls will ask for.
   *
   * A file a project has not seen invalidates its program and its type checker's cache. Extracting
   * a run one component at a time therefore rebuilds the program for each of them, unless the
   * project receives all of the run's files before its first extraction.
   */
  setBatch(entries: StoryRef[]): void {
    this.batch = entries.filter(isExtractable);
    this.batchFiles = undefined;
  }

  /**
   * Batch-extract component props across all entries, grouping by tsconfig project so each project
   * builds its TS program only once.
   */
  batchExtract(entries: StoryRef[]): void {
    const byProject = groupByToMap(entries.filter(isExtractable), (storyRef) =>
      this.getProjectForFile(storyRef.storyPath)
    );

    for (const [project, projectEntries] of byProject) {
      try {
        this.addBatchFiles(project);
        project.extractPropsFromStories(projectEntries);
      } catch (err) {
        logger.debug(`[reactComponentMeta] Batch extraction failed: ${err}`);
      }
    }

    // Programs holding the whole batch did not fit the heap, and giving the batch to the fresh
    // projects would fill it again, so the rest of the run adds files as it reaches them.
    if (this.recycleProjectsIfHeapPressured()) {
      this.setBatch([]);
    }
  }

  private addBatchFiles(project: ManagedProject): void {
    if (this.batch.length === 0) {
      return;
    }
    // A project missing from the map was created after the batch was last grouped, so a tsconfig
    // change may have moved files between projects.
    if (!this.batchFiles?.has(project)) {
      this.batchFiles = this.groupBatchFiles();
      if (!this.batchFiles.has(project)) {
        this.batchFiles.set(project, []);
      }
    }
    const files = this.batchFiles.get(project);
    if (files?.length) {
      project.ensureFiles(files);
      this.batchFiles.set(project, []);
    }
  }

  // Finding a file's project is the expensive part, so each story file is looked up once.
  private groupBatchFiles(): Map<ManagedProject, string[]> {
    const projectByStoryPath = new Map<string, ManagedProject>();
    const files = new Map<ManagedProject, string[]>();
    for (const { storyPath, component } of this.batch) {
      const project = projectByStoryPath.get(storyPath) ?? this.getProjectForFile(storyPath);
      projectByStoryPath.set(storyPath, project);
      const projectFiles = files.get(project) ?? [];
      files.set(project, projectFiles);
      projectFiles.push(storyPath, ...(component?.path ? [component.path] : []));
    }
    return files;
  }
}

const isExtractable = (storyRef: StoryRef) =>
  !!storyRef.component?.path && !!storyRef.component.importName;
