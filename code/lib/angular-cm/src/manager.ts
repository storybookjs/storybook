import {
  ComponentMetaManager,
  type ComponentMetaProjectFactory,
  parseTsconfigCommandLine,
} from 'storybook/internal/component-meta';

import type * as ts from 'typescript';

import { AngularComponentMetaProject, type FsFileSnapshots } from './project.ts';
import type { AngularComponentMetaResult } from './types.ts';

function createAngularProjectFactory(
  typescript: typeof ts
): ComponentMetaProjectFactory<AngularComponentMetaProject, ts.ParsedCommandLine> {
  const fsFileSnapshots: FsFileSnapshots = new Map();

  // Shared so projects reuse parsed SourceFiles instead of each holding a private copy of lib.d.ts.
  const documentRegistry = typescript.createDocumentRegistry(
    typescript.sys.useCaseSensitiveFileNames
  );

  return {
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
            // Permissive defaults for files no tsconfig claims, which still use legacy decorators.
            strict: false,
            allowJs: true,
            skipLibCheck: true,
            experimentalDecorators: true,
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
}

/**
 * Extract argTypes-ready metadata for Angular components straight from their TypeScript sources.
 *
 * Keeps one warm LanguageService per matched tsconfig, so bracket the manager's lifetime with
 * `startWatching()`/`dispose()`.
 */
export class AngularComponentMetaManager extends ComponentMetaManager<
  AngularComponentMetaProject,
  ts.ParsedCommandLine
> {
  constructor(typescript: typeof ts) {
    super(typescript, createAngularProjectFactory(typescript));
  }

  /**
   * Extract the metadata for one component, or `undefined` when neither the file nor its
   * re-export target declares a class matching `names`.
   */
  extractComponentMeta(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    return this.getProjectForFile(componentPath).extract(componentPath, names);
  }

  /** Release cached projects under heap pressure; with no batch surface, call it per payload. */
  recycleIfHeapPressured(): void {
    this.recycleProjectsIfHeapPressured();
  }
}
