/**
 * React specialization of core's generic {@link BaseComponentMetaManager}.
 *
 * The tsconfig discovery/matching, project-reference chains, file watching, and heap-pressure
 * recycling all live in `storybook/internal/component-meta`; this file contributes what is
 * React-specific: a {@link ComponentMetaProjectFactory} that builds {@link ComponentMetaProject}s
 * (one TS LanguageService per tsconfig, sharing one mtime-cached snapshot map), React-flavored
 * inferred-project compiler options, and the {@link ComponentMetaManager.batchExtract} surface the
 * manifest generator and docgen provider drive.
 */
import {
  ComponentMetaManager as BaseComponentMetaManager,
  type ComponentMetaProjectFactory,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';
import { logger } from 'storybook/internal/node-logger';

import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import { groupByToMap } from '../utils.ts';
import { ComponentMetaProject } from './ComponentMetaProject.ts';

// The manager's tsconfig-matching helpers are re-exported for existing consumers and tests.
export { isFileInDir, sortTSConfigs } from 'storybook/internal/component-meta';

const DEFAULT_INFERRED_OPTIONS: ts.CompilerOptions = {
  strict: true,
  esModuleInterop: true,
  allowJs: true,
  skipLibCheck: true,
};

type FsFileSnapshots = Map<string, [number | undefined, ts.IScriptSnapshot | undefined]>;

/**
 * Builds the React project factory plus the snapshot cache it closes over. The cache is shared
 * across every project the factory creates (Volar Kit checker pattern) and returned separately so
 * the manager can expose it to tests; it is cleared through the factory's `dispose`.
 */
function createReactProjectFactory(typescript: typeof ts): {
  factory: ComponentMetaProjectFactory<ComponentMetaProject, ts.ParsedCommandLine>;
  fsFileSnapshots: FsFileSnapshots;
} {
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

  return {
    fsFileSnapshots,
    factory: {
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
    },
  };
}

export class ComponentMetaManager extends BaseComponentMetaManager<
  ComponentMetaProject,
  ts.ParsedCommandLine
> {
  /** Shared mtime-cached file snapshots, exposed for tests; owned by the factory. */
  readonly fsFileSnapshots: FsFileSnapshots;

  /**
   * @param recycleHeapPressureRatio Fraction of the V8 heap limit at which the shared program(s)
   *   are recycled. Exposed for tuning and for the memory regression gate, which passes `Infinity`
   *   to disable recycling and assert the OOM still happens without the fix.
   */
  constructor(typescript: typeof ts, recycleHeapPressureRatio?: number) {
    const { factory, fsFileSnapshots } = createReactProjectFactory(typescript);
    super(typescript, factory, recycleHeapPressureRatio);
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
