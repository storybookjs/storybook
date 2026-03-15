/**
 * ComponentMetaProject — one TS LanguageService per tsconfig.
 *
 * Mirrors Volar-style checker/project-host patterns:
 *
 * - https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L83-L461
 * - https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/language-server/lib/project/typescriptProjectLs.ts#L44-L233
 * - https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/typescript/lib/protocol/createProject.ts#L30-L120
 * - CreateLanguage + createLanguageServiceHost from @volar/typescript
 * - FsFileSnapshots with mtime-based caching (shared across projects)
 * - TypeScriptProjectHost contract (projectVersion, shouldCheckRootFiles, checkRootFilesUpdate)
 * - Selective projectVersion bump on file events (Kit checker pattern)
 * - EnsureFiles for dynamic file inclusion (LS pattern)
 *
 * Props extraction works probe-free:
 *
 * - Path 1 (primary): Find JSX in story files → getResolvedSignature() → props type
 * - Path 2 (fallback): Direct type inspection for args-only stories (component-meta approach)
 * - SerializeComponentDoc() serializes the resolved props type into ComponentDoc format
 */
import { FileMap, createLanguage } from '@volar/language-core';
import {
  type TypeScriptProjectHost,
  createLanguageServiceHost,
  resolveFileLanguageId,
} from '@volar/typescript';
import * as path from 'path';
import type ts from 'typescript';

import {
  type ComponentDoc,
  resolvePropsFromComponentType,
  resolvePropsFromStoryFile,
  serializeComponentDoc,
} from '../componentMetaExtractor';
import type { StoryRef } from '../getComponentImports';
import type { ComponentRef, ResolvedComponentTarget } from '../types';

export class ComponentMetaProject {
  private ls: ts.LanguageService;
  private projectVersion = 0;
  private shouldCheckRootFiles = false;
  private warmupTimer?: ReturnType<typeof setTimeout>;
  /** Entries to extract — set by the generator, replayed during warmup for targeted type resolution. */
  private entries: StoryRef[] = [];

  constructor(
    private typescript: typeof ts,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    /**
     * Shared snapshot cache owned by ComponentMetaManager.
     *
     * Adapted from:
     * https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L83
     */
    private fsFileSnapshots: Map<
      string,
      [number | undefined, ts.IScriptSnapshot | undefined]
    > = new Map(),
    private getCommandLineFn?: () => ts.ParsedCommandLine
  ) {
    // Adapted from:
    // https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L110-L141
    const language = createLanguage<string>(
      [{ getLanguageId: (fileName: string) => resolveFileLanguageId(fileName) }],
      new FileMap(typescript.sys.useCaseSensitiveFileNames),
      (fileName, includeFsFiles) => {
        if (!includeFsFiles) {
          return;
        }
        const cache = fsFileSnapshots.get(fileName);
        const modifiedTime = typescript.sys.getModifiedTime?.(fileName)?.valueOf();
        if (!cache || cache[0] !== modifiedTime) {
          if (typescript.sys.fileExists(fileName)) {
            const text = typescript.sys.readFile(fileName);
            const snapshot =
              text !== undefined ? typescript.ScriptSnapshot.fromString(text) : undefined;
            fsFileSnapshots.set(fileName, [modifiedTime, snapshot]);
          } else {
            fsFileSnapshots.set(fileName, [modifiedTime, undefined]);
          }
        }
        const snapshot = fsFileSnapshots.get(fileName)?.[1];
        if (snapshot) {
          language.scripts.set(fileName, snapshot);
        } else {
          language.scripts.delete(fileName);
        }
      }
    );

    // Adapted from:
    // https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L359-L383
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
      getProjectVersion: () => {
        this.checkRootFilesUpdate();
        return this.projectVersion.toString();
      },
      getScriptFileNames: () => {
        this.checkRootFilesUpdate();
        return this.commandLine.fileNames;
      },
    };

    // Adapted from:
    // https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/typescript/lib/protocol/createProject.ts#L30-L120
    const { languageServiceHost } = createLanguageServiceHost(
      typescript,
      typescript.sys,
      language,
      (s) => s, // asScriptId — identity for React (no URI mapping needed)
      projectHost
    );

    this.ls = typescript.createLanguageService(languageServiceHost);
  }

  getCommandLine(): ts.ParsedCommandLine {
    return this.commandLine;
  }

  dispose() {
    clearTimeout(this.warmupTimer);
    this.ls.dispose();
  }

  // ---------------------------------------------------------------------------
  // Project management
  // ---------------------------------------------------------------------------

  /**
   * Batch-add multiple files to the project in one go. Only bumps projectVersion once, avoiding
   * repeated program rebuilds.
   */
  ensureFiles(fileNames: string[]): void {
    let added = false;
    for (const fileName of fileNames) {
      if (!this.commandLine.fileNames.includes(fileName)) {
        this.commandLine.fileNames.push(fileName);
        added = true;
      }
    }
    if (added) {
      this.projectVersion++;
    }
  }

  /**
   * Adapted from:
   * https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L436-L447
   */
  private checkRootFilesUpdate(): void {
    if (!this.shouldCheckRootFiles) {
      return;
    }
    this.shouldCheckRootFiles = false;

    if (!this.getCommandLineFn) {
      return;
    }
    const newCommandLine = this.getCommandLineFn();
    if (!arrayItemsEqual(newCommandLine.fileNames, this.commandLine.fileNames)) {
      this.commandLine.fileNames = newCommandLine.fileNames;
      this.projectVersion++;
    }
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.ls.getProgram()?.getSourceFile(fileName);
  }

  /**
   * Get all non-node_modules source file paths from the TS program. Used by ComponentMetaManager to
   * watch directories for file changes.
   */
  getSourceFilePaths(): string[] {
    const program = this.ls.getProgram();
    if (!program) {
      return [];
    }
    return program
      .getSourceFiles()
      .map((sf) => sf.fileName.replace(/\\/g, '/'))
      .filter((f) => !f.includes('node_modules'));
  }

  /**
   * Adapted from:
   * https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L409-L432
   *
   * Created events only set shouldCheckRootFiles (version bump happens in checkRootFilesUpdate if
   * the file list actually changed). Deleted/created break early since they trigger a full config
   * reparse — processing remaining changes is unnecessary.
   */
  onFilesChanged(
    changes: Array<{ filePath: string; type: 'changed' | 'created' | 'deleted' }>
  ): void {
    // Eagerly invalidate snapshot cache for ALL changes before processing.
    // Deleting from fsFileSnapshots ensures the sync callback re-reads the file.
    for (const { filePath } of changes) {
      this.fsFileSnapshots.delete(filePath);
    }

    const oldVersion = this.projectVersion;
    const program = this.ls.getProgram();
    for (const { filePath, type } of changes) {
      if (type === 'changed') {
        if (program?.getSourceFile(filePath)) {
          this.projectVersion++;
        }
      } else if (type === 'deleted') {
        if (program?.getSourceFile(filePath)) {
          this.projectVersion++;
        }
        this.shouldCheckRootFiles = true;
        break;
      } else if (type === 'created') {
        this.shouldCheckRootFiles = true;
        break;
      }
    }

    // Targeted warmup: re-extract in the background so the next request is instant.
    // Only resolves the specific types we need (story JSX → getResolvedSignature),
    // not the entire program. TypeScript caches resolved types on AST nodes —
    // the real extraction then hits cached results.
    if (this.projectVersion !== oldVersion && this.entries.length > 0) {
      clearTimeout(this.warmupTimer);
      this.warmupTimer = setTimeout(() => {
        try {
          this.extractPropsFromStories(this.entries);
        } catch {
          // Warmup failure is non-fatal — extraction will still work on demand.
        }
      }, 100);
      this.warmupTimer?.unref?.();
    }
  }

  // ---------------------------------------------------------------------------
  // Primary extraction method — probe-free
  // ---------------------------------------------------------------------------

  extractPropsFromStories(entries: StoryRef[]): void {
    this.entries = entries;

    const allFiles = entries.flatMap((entry) =>
      entry.component?.path ? [entry.storyPath, entry.component.path] : [entry.storyPath]
    );
    this.ensureFiles(allFiles);
    this.ensureFresh(allFiles);

    const program = this.ls.getProgram();
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
        const memberAccess = entryComponent.member;
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

        // Path 2: Fallback — resolve from meta.component in the story file.
        // Only fires when the user explicitly set `component:` in the meta object.
        if (!resolvedComponent) {
          resolvedComponent = this.resolveFromMetaComponent(
            checker,
            storySourceFile,
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

  /**
   * Check mtime for specific files and bump projectVersion if any changed.
   *
   * This bypasses the sync() gate in createLanguageServiceHost — sync() only runs when
   * projectVersion changes, so mtime-based cache alone can't detect stale files. We do a targeted
   * mtime check for the files we're about to extract from, ensuring freshness even when the
   * fs.watch event hasn't arrived yet (race with HMR) or was missed entirely.
   */
  private ensureFresh(fileNames: string[]): void {
    let stale = false;
    for (const fileName of fileNames) {
      const cache = this.fsFileSnapshots.get(fileName);
      if (!cache) {
        continue;
      }
      const currentMtime = this.typescript.sys.getModifiedTime?.(fileName)?.valueOf();
      if (cache[0] !== currentMtime) {
        this.fsFileSnapshots.delete(fileName);
        stale = true;
      }
    }
    if (stale) {
      this.projectVersion++;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Path 2 fallback: resolve the component type from the story file's `meta.component` property.
   * Only works when the user explicitly set `component:` in the meta — no node means no
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
    if (!componentProp) {
      return undefined;
    }

    let componentType = checker.getTypeOfSymbol(componentProp);
    let selectedSymbol =
      componentProp.valueDeclaration &&
      this.typescript.isPropertyAssignment(componentProp.valueDeclaration)
        ? checker.getSymbolAtLocation(componentProp.valueDeclaration.initializer)
        : componentType.getSymbol?.();

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

// Adapted from:
// https://github.com/volarjs/volar.js/blob/882cd56d46a13d272f34e451f495d3d62251969a/packages/kit/lib/createChecker.ts#L450-L461
function arrayItemsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  const set = new Set(a);
  for (const file of b) {
    if (!set.has(file)) {
      return false;
    }
  }
  return true;
}
