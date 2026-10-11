/**
 * One TypeScript LanguageService per tsconfig, built on the checker and project-host patterns from
 * `@volar/typescript`. Freshness is not decided here: the snapshot cache, projectVersion gate and
 * root-set re-checks all live in core's `ProjectFileTracker`, which the Angular analyzer shares.
 *
 * A generic component's props are not resolvable from its own file: the first parameter stays
 * `Props<T>` until a call site instantiates it. The story's JSX gives a resolved call signature, so
 * it is tried first, and a story with no JSX falls back to the component's own export. Nothing else
 * needs the use site - forwardRef, memo, styled() and HOC wrappers all resolve the same either way.
 *
 * The first matching JSX element wins, so for a component rendered with different type arguments
 * across stories, the documented type is the one the earliest story pins.
 */
import {
  type FileChange,
  type FileSnapshotCache,
  ProgramBackedProject,
  ProjectFileTracker,
} from 'storybook/internal/component-meta';

import { FileMap, createLanguage } from '@volar/language-core';
import {
  type TypeScriptProjectHost,
  createLanguageServiceHost,
  resolveFileLanguageId,
} from '@volar/typescript';
import * as path from 'path';
import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports.ts';
import type { ComponentRef, ResolvedComponentTarget } from '../types.ts';
import {
  metaComponentMatchesRef,
  resolvePropsFromComponentExport,
  resolvePropsFromComponentType,
  resolvePropsFromStoryFile,
  serializeComponentDoc,
} from './componentMetaExtractor.ts';

export class ComponentMetaProject extends ProgramBackedProject<
  ts.IScriptSnapshot,
  ts.SourceFile | undefined
> {
  protected readonly service: ts.LanguageService;
  /** Invalidation state machine shared with the Angular component-meta project. */
  protected readonly files: ProjectFileTracker<ts.IScriptSnapshot>;
  private warmupTimer?: ReturnType<typeof setTimeout>;
  /** Entries to extract - set by the generator, replayed during warmup for targeted type resolution. */
  private entries: StoryRef[] = [];

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    /** Shared snapshot cache owned by ComponentMetaManager. */
    fsFileSnapshots: FileSnapshotCache<ts.IScriptSnapshot> = new Map(),
    getCommandLineFn?: () => ts.ParsedCommandLine,
    /**
     * Shared by ComponentMetaManager so projects with matching compiler options reuse parsed+bound
     * SourceFiles. The snapshot cache above dedupes the file *reads*, not the ASTs: without a shared
     * registry each LanguageService re-parses lib.d.ts, React's types and node_modules from scratch.
     */
    private documentRegistry?: ts.DocumentRegistry
  ) {
    super();
    this.files = new ProjectFileTracker(
      typescript,
      commandLine,
      fsFileSnapshots,
      (text) => typescript.ScriptSnapshot.fromString(text),
      getCommandLineFn
    );

    // Adapted from the language construction in @volar/kit's createChecker.
    const language = createLanguage<string>(
      [{ getLanguageId: (fileName: string) => resolveFileLanguageId(fileName) }],
      new FileMap(typescript.sys.useCaseSensitiveFileNames),
      (fileName, includeFsFiles) => {
        if (!includeFsFiles) {
          return;
        }
        const snapshot = this.files.getSnapshot(fileName);
        if (snapshot) {
          language.scripts.set(fileName, snapshot);
        } else {
          language.scripts.delete(fileName);
        }
      }
    );

    // Adapted from the project host in @volar/kit's createChecker.
    const projectHost: TypeScriptProjectHost = {
      getCurrentDirectory: () =>
        configFileName
          ? path.dirname(configFileName)
          : (commandLine.options.rootDir ?? process.cwd()),
      getCompilationSettings: () => {
        return this.commandLine.options;
      },
      getProjectReferences: () => {
        return this.commandLine.projectReferences;
      },
      // getProjectVersion gates the language service's host re-sync; the tracker funnels every
      // invalidation into it.
      getProjectVersion: () => this.files.getProjectVersion(),
      getScriptFileNames: () => this.files.getScriptFileNames(),
    };

    // Adapted from @volar/typescript's createProject.
    const { languageServiceHost } = createLanguageServiceHost(
      typescript,
      typescript.sys,
      language,
      (s) => s, // asScriptId - identity for React (no URI mapping needed)
      projectHost
    );

    this.service = typescript.createLanguageService(languageServiceHost, this.documentRegistry);
  }

  getCommandLine(): ts.ParsedCommandLine {
    return this.commandLine;
  }

  // ---------------------------------------------------------------------------
  // Project management
  // ---------------------------------------------------------------------------

  /** Cancels the warmup the base does not know about. */
  override dispose(): void {
    clearTimeout(this.warmupTimer);
    super.dispose();
  }

  getSourceFile(fileName: string): ts.SourceFile | undefined {
    return this.service.getProgram()?.getSourceFile(fileName);
  }

  override onFilesChanged(changes: FileChange[]): void {
    // Membership probe against the pre-event program; captured once so the batch cannot rebuild
    // the program mid-loop.
    const program = this.service.getProgram();
    const versionMoved = this.files.onFilesChanged(
      changes,
      (fileName) => !!program?.getSourceFile(fileName)
    );

    // Targeted warmup: re-extract in the background so the next request is instant. Only the types
    // the stories actually need get resolved, and TypeScript caches those on the AST nodes, so the
    // real extraction that follows hits cached results.
    if (versionMoved && this.entries.length > 0) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = setTimeout(() => {
        try {
          this.extractPropsFromStories(this.entries);
        } catch {
          // Warmup failure is non-fatal - extraction will still work on demand.
        }
      }, 100);
      this.warmupTimer?.unref?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Primary extraction method - probe-free
  // ---------------------------------------------------------------------------

  extractPropsFromStories(entries: StoryRef[]): void {
    this.entries = entries;

    const allFiles = entries.flatMap((entry) =>
      entry.component?.path ? [entry.storyPath, entry.component.path] : [entry.storyPath]
    );
    this.files.ensureFiles(allFiles);
    this.files.ensureFresh(allFiles);

    const program = this.service.getProgram();
    if (!program) {
      return;
    }
    const checker = program.getTypeChecker();
    const serializationContextByComponentPath = new Map<
      string,
      { sourceFile: ts.SourceFile; defaultsSourcePath?: string }
    >();

    for (const entry of entries) {
      try {
        const storySourceFile = program.getSourceFile(entry.storyPath);
        const entryComponent = entry.component;
        const componentPath = entryComponent?.path;
        const exportName = entryComponent?.importName;
        if (!storySourceFile || !componentPath || !exportName || !entryComponent) {
          continue;
        }

        const importId = entryComponent.importId;
        const isPackageImport = importId && !importId.startsWith('.');
        let componentSourceFile: ts.SourceFile | undefined;

        if (isPackageImport) {
          const resolved = this.typescript.resolveModuleName(
            importId!,
            entry.storyPath,
            this.commandLine.options,
            this.typescript.sys
          );
          componentSourceFile = resolved.resolvedModule
            ? program.getSourceFile(resolved.resolvedModule.resolvedFileName)
            : program.getSourceFile(componentPath);
        } else {
          componentSourceFile = program.getSourceFile(componentPath);
        }

        if (!componentSourceFile) {
          continue;
        }

        // Path 1: Find JSX in story file
        let resolvedComponent: ResolvedComponentTarget | undefined;
        if (importId) {
          resolvedComponent = resolvePropsFromStoryFile(
            this.typescript,
            checker,
            storySourceFile,
            entryComponent
          );
        }

        // Path 2: Fallback - resolve from meta.component in the story file.
        // Only fires when the user explicitly set `component:` in the meta object.
        // Only applies to the meta component itself, not declared subcomponents.
        if (!resolvedComponent) {
          resolvedComponent = this.resolveFromMetaComponent(
            checker,
            storySourceFile,
            entryComponent
          );
        }

        // Path 3: Resolve directly from the component module export (declared subcomponents).
        if (!resolvedComponent) {
          resolvedComponent = resolvePropsFromComponentExport(
            this.typescript,
            checker,
            componentSourceFile,
            entryComponent
          );
        }

        if (!resolvedComponent) {
          continue;
        }

        let serializationContext = serializationContextByComponentPath.get(componentPath);
        if (serializationContext === undefined) {
          const resolvedFileName = componentSourceFile.fileName;
          serializationContext = {
            sourceFile: componentSourceFile,
            defaultsSourcePath:
              resolvedFileName.endsWith('.d.ts') ||
              resolvedFileName.endsWith('.d.mts') ||
              resolvedFileName.endsWith('.d.cts')
                ? componentPath
                : undefined,
          };
          serializationContextByComponentPath.set(componentPath, serializationContext);
        }

        const doc = serializeComponentDoc(this.typescript, checker, {
          sourceFile: serializationContext.sourceFile,
          resolvedComponent,
          defaultsSourcePath: serializationContext.defaultsSourcePath,
        });

        if (doc) {
          entryComponent.reactComponentMeta = doc;
          entryComponent.componentJsDocTags = doc.jsDocTags;
          entryComponent.importOverride = entryComponent.componentJsDocTags?.import?.[0]?.trim();
        }
      } catch {
        // One bad component should not kill the entire batch.
        continue;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Path 2 fallback: resolve the component type from the story file's `meta.component` property.
   * Only works when the user explicitly set `component:` in the meta - no node means no
   * extraction.
   */
  private resolveFromMetaComponent(
    checker: ts.TypeChecker,
    storySourceFile: ts.SourceFile,
    componentRef: ComponentRef
  ): ResolvedComponentTarget | undefined {
    const { member: memberAccess } = componentRef;
    const moduleSymbol = checker.getSymbolAtLocation(storySourceFile);
    if (!moduleSymbol) {
      return undefined;
    }

    const defaultExport = checker
      .getExportsOfModule(moduleSymbol)
      .find((e) => e.getName() === 'default');
    if (!defaultExport) {
      return undefined;
    }

    const metaType = checker.getTypeOfSymbol(defaultExport);
    const componentProp = metaType.getProperty('component');
    if (
      !componentProp?.valueDeclaration ||
      !this.typescript.isPropertyAssignment(componentProp.valueDeclaration)
    ) {
      return undefined;
    }

    const metaComponentInitializer = componentProp.valueDeclaration.initializer;
    if (
      !metaComponentInitializer ||
      !metaComponentMatchesRef(
        this.typescript,
        checker,
        storySourceFile,
        componentRef,
        metaComponentInitializer
      )
    ) {
      return undefined;
    }

    let componentType = checker.getTypeOfSymbol(componentProp);
    let selectedSymbol = checker.getSymbolAtLocation(metaComponentInitializer);

    if (memberAccess) {
      const prop = componentType.getProperty(memberAccess);
      if (prop) {
        componentType = checker.getTypeOfSymbol(prop);
        selectedSymbol = prop;
      } else {
        return undefined;
      }
    }

    const propsType = resolvePropsFromComponentType(this.typescript, checker, componentType);
    if (!propsType || !selectedSymbol) {
      return undefined;
    }

    return {
      componentRef,
      propsType,
      symbol: selectedSymbol,
    };
  }
}
