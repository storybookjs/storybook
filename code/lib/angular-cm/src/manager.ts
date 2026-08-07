/**
 * Angular specialization of core's generic ComponentMetaManager. Tsconfig discovery/matching,
 * project-reference chains, file watching, and heap-pressure recycling live in
 * `storybook/internal/component-meta`; the factory below contributes the Angular specifics: one
 * {@link AngularComponentMetaProject} per tsconfig sharing a single mtime-keyed snapshot map, and
 * the inferred-project compiler options for files no tsconfig covers.
 */
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
  // Shared across every project the factory creates (Volar Kit checker pattern); dies with the
  // manager through the factory's dispose.
  const fsFileSnapshots: FsFileSnapshots = new Map();

  /**
   * Shared across every project so they reuse parsed+bound SourceFiles instead of each holding a
   * private copy of lib.d.ts, Angular's types and node_modules. Needs no cleanup of its own:
   * disposing a LanguageService releases every SourceFile it holds, and the registry drops an
   * entry once its last reference goes. `useCaseSensitiveFileNames` defaults to `false`, which
   * would lowercase the registry's path keys on case-sensitive filesystems, so pass the host's
   * value explicitly.
   */
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
            // Non-strict to stay permissive for files no tsconfig claims; experimentalDecorators
            // because Angular components without a tsconfig still use legacy decorators.
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
    dispose: () => fsFileSnapshots.clear(),
  };
}

/**
 * Extracts compodoc-shaped metadata for Angular components straight from their TypeScript sources,
 * keeping one warm LanguageService per matched tsconfig. Construct it with the consumer project's
 * `typescript` module (this package depends on it only as a type), extract per component, and
 * bracket the manager's lifetime with `startWatching()`/`dispose()`.
 *
 * @example
 *
 * ```ts
 * import ts from 'typescript';
 *
 * const manager = new AngularComponentMetaManager(ts);
 * manager.startWatching(); // keep programs fresh as files change on disk
 * const meta = manager.extractComponentMeta('/app/src/button.component.ts', {
 *   exportName: 'ButtonComponent',
 * });
 * manager.dispose();
 * ```
 */
export class AngularComponentMetaManager extends ComponentMetaManager<
  AngularComponentMetaProject,
  ts.ParsedCommandLine
> {
  constructor(typescript: typeof ts) {
    super(typescript, createAngularProjectFactory(typescript));
  }

  /**
   * Extract the compodoc-shaped meta for one component. The project stats its cached snapshots
   * first, so extractions racing an editor save before the debounced watch event lands still see
   * the on-disk content. Returns `undefined` when the file (or its re-export target) contains no
   * class matching the given names.
   */
  extractComponentMeta(
    componentPath: string,
    names: { exportName: string; localName?: string }
  ): AngularComponentMetaResult | undefined {
    return this.getProjectForFile(componentPath).extract(componentPath, names);
  }

  /** Post-extraction heap check; there is no batch surface, so callers invoke this per payload. */
  recycleIfHeapPressured(): void {
    this.recycleProjectsIfHeapPressured();
  }
}
