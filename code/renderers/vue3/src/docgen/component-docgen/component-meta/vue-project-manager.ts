/**
 * Vue specialization of core's generic `ComponentMetaManager`.
 *
 * The manager contributes what `vue-component-meta` lacks: tsconfig discovery per file,
 * project-reference resolution, multi-project lifecycle, file watching, and heap-pressure
 * recycling. Each matched tsconfig becomes its own checker, so a `create-vue` root config that only
 * holds `references` resolves to the sub-config that actually includes the component — instead of
 * the whole-project `include: ['**\/*']` fallback checker that `createVueComponentMetaChecker` in
 * `./component-meta.ts` still uses for the legacy Vite path.
 *
 * The checker keeps its own snapshot cache internally (unlike React's project, which shares the
 * manager-side mtime cache), so this adapter's job on file events is to push content into the
 * checker via `updateFile`/`deleteFile` rather than to invalidate a shared map.
 *
 * @see https://github.com/vuejs/language-tools/issues/3896 — upstream issue: vue-component-meta
 *   does not resolve tsconfig project references.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, posix } from 'node:path';

import { getProjectRoot, slash } from 'storybook/internal/common';
import {
  ComponentMetaManager,
  type ComponentMetaProjectBase,
  type ComponentMetaProjectFactory,
  type FileChange,
} from 'storybook/internal/component-meta';

import {
  type ParsedCommandLine as VueParsedCommandLine,
  type VueCompilerOptions,
  createParsedCommandLine,
  createParsedCommandLineByJson,
  getAllExtensions,
} from '@vue/language-core';
import type ts from 'typescript';
import { type ComponentMetaChecker, createChecker, createCheckerByJson } from 'vue-component-meta';
import type { createCheckerBase } from 'vue-component-meta/lib/checker.js';

export type CreateCheckerBase = typeof createCheckerBase;

import { CHECKER_OPTIONS } from './component-meta.ts';

/**
 * Raw-JSON compiler options for files no discovered tsconfig covers (`createCheckerByJson` parses
 * JSON, so these are tsconfig spellings, not `ts.CompilerOptions` enums). Mirrors the intent of the
 * React inferred project's defaults, with `jsx: preserve` in place of `react-jsx`.
 */
const INFERRED_COMPILER_OPTIONS = {
  strict: true,
  allowJs: true,
  skipLibCheck: true,
  target: 'esnext',
  module: 'esnext',
  moduleResolution: 'bundler',
  jsx: 'preserve',
};

/** One `vue-component-meta` checker per matched tsconfig. */
export class VueComponentMetaProject implements ComponentMetaProjectBase {
  /**
   * Modification time of the text the checker last read, per absolute path — only for files this
   * project has been asked to keep fresh. The checker's snapshot cache never re-reads on its own,
   * so without this an extraction racing an editor save would serve stale docgen forever.
   */
  private readonly mtimes = new Map<string, number>();
  private readonly pendingCreatedFiles = new Set<string>();

  constructor(
    public readonly checker: ComponentMetaChecker,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    private getCommandLineFn?: () => ts.ParsedCommandLine
  ) {}

  getCommandLine(): ts.ParsedCommandLine {
    this.replayPendingCreatedFiles();
    return this.commandLine;
  }

  private replayPendingCreatedFiles(): void {
    if (this.pendingCreatedFiles.size === 0) {
      return;
    }

    const pendingCreatedFiles = [...this.pendingCreatedFiles];
    this.pendingCreatedFiles.clear();

    const commandLine = this.getCommandLineFn?.();
    if (!commandLine) {
      return;
    }

    this.commandLine = commandLine;
    const rootFiles = new Set(commandLine.fileNames);
    for (const fileName of pendingCreatedFiles) {
      if (!rootFiles.has(fileName)) {
        continue;
      }
      const text = tryReadFile(fileName);
      if (text !== undefined) {
        this.checker.updateFile(fileName, text);
      }
    }
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.checker.getProgram()?.getSourceFile(slash(fileName));
  }

  /** Push files the program does not know yet into the checker (inferred-project inclusion). */
  ensureFiles(fileNames: string[]): void {
    for (const fileName of fileNames) {
      const normalized = slash(fileName);
      if (this.hasSourceFile(normalized)) {
        continue;
      }
      const text = tryReadFile(normalized);
      if (text !== undefined) {
        this.checker.updateFile(normalized, text);
      }
    }
  }

  /**
   * Re-read the given files when their mtime moved since the checker last saw them. The targeted
   * counterpart of the manager's watch layer, covering the race where an extraction lands before
   * the debounced fs.watch event (same role as the React project's `ensureFresh`).
   */
  ensureFresh(fileNames: string[]): void {
    for (const fileName of fileNames) {
      const normalized = slash(fileName);
      const mtime = statMtime(normalized);
      if (mtime === undefined) {
        continue;
      }

      const previous = this.mtimes.get(normalized);
      if (previous === undefined) {
        // First sighting: the checker reads the file itself on first access, so the snapshot is
        // current as of now. Record the mtime so the next edit registers as a change.
        this.mtimes.set(normalized, mtime);
        continue;
      }
      if (previous === mtime) {
        continue;
      }

      const text = tryReadFile(normalized);
      if (text !== undefined) {
        this.checker.updateFile(normalized, text);
        this.mtimes.set(normalized, statMtime(normalized) ?? mtime);
      }
    }
  }

  onFilesChanged(changes: FileChange[]): void {
    for (const { filePath, type } of changes) {
      const fileName = slash(filePath);

      if (type === 'deleted') {
        this.pendingCreatedFiles.delete(fileName);
        if (this.hasSourceFile(fileName)) {
          this.checker.deleteFile(fileName);
        }
        this.mtimes.delete(fileName);
        continue;
      }

      if (type === 'changed') {
        // Only refresh files this program actually holds — bumping the checker's projectVersion
        // for unrelated files would rebuild the program for nothing.
        if (!this.hasSourceFile(fileName)) {
          continue;
        }
        const text = tryReadFile(fileName);
        if (text !== undefined) {
          this.checker.updateFile(fileName, text);
          this.mtimes.set(fileName, statMtime(fileName) ?? Date.now());
        }
        continue;
      }

      if (this.getCommandLineFn) {
        this.pendingCreatedFiles.add(fileName);
      }
    }
  }

  getSourceFilePaths(): string[] {
    const program = this.checker.getProgram();
    if (!program) {
      return [];
    }
    return program
      .getSourceFiles()
      .map((sourceFile) => slash(sourceFile.fileName))
      .filter((fileName) => !fileName.includes('node_modules'));
  }

  dispose(): void {
    this.checker.clearCache();
    this.mtimes.clear();
    this.pendingCreatedFiles.clear();
  }
}

const vueFileExtensions = (typescript: typeof ts, vueOptions: VueCompilerOptions) =>
  getAllExtensions(vueOptions).map((extension) => ({
    extension: extension.slice(1),
    isMixedContent: true,
    scriptKind: typescript.ScriptKind.Deferred,
  }));

/**
 * Mirrors vue-component-meta's own config loading
 *
 * Matching the checker's recipe exactly means the manager matches files against the same set the
 * checker's program will contain — a plain TS parse would never list `.vue` files and every SFC
 * would fall through direct-include matching.
 *
 * @see https://github.com/vuejs/language-tools/blob/v3.3.2/packages/component-meta/index.ts — the
 *   two-step parse this reproduces.
 * @see https://github.com/vuejs/language-tools/blob/v3.3.8/packages/language-core/lib/compilerOptions.ts
 *   — `createParsedCommandLine` and its `readDirectory` stub.
 */
function readVueTsconfig(
  typescript: typeof ts,
  tsconfig: string
): [commandLine: VueParsedCommandLine, fileNames: string[]] {
  const commandLine = createParsedCommandLine(typescript, typescript.sys, tsconfig);
  const { fileNames } = typescript.parseJsonSourceFileConfigFileContent(
    typescript.readJsonConfigFile(tsconfig, typescript.sys.readFile),
    typescript.sys,
    dirname(tsconfig),
    {},
    tsconfig,
    undefined,
    vueFileExtensions(typescript, commandLine.vueOptions)
  );
  return [commandLine, fileNames];
}

function readInferredConfig(
  typescript: typeof ts,
  rootDir: string
): [commandLine: VueParsedCommandLine, fileNames: string[]] {
  const json = { compilerOptions: INFERRED_COMPILER_OPTIONS, include: [] };
  const commandLine = createParsedCommandLineByJson(typescript, typescript.sys, rootDir, json);
  const { fileNames } = typescript.parseJsonConfigFileContent(
    json,
    typescript.sys,
    rootDir,
    {},
    undefined,
    undefined,
    vueFileExtensions(typescript, commandLine.vueOptions)
  );
  return [commandLine, fileNames];
}

function createVueProjectFactory(
  typescript: typeof ts,
  createCheckerBase: CreateCheckerBase | undefined
): ComponentMetaProjectFactory<VueComponentMetaProject, ts.ParsedCommandLine> {
  // `createChecker` and `createCheckerByJson` load the project's own `typescript`, which has no
  // compiler API on TypeScript 7, so prefer the base function that takes the module as an argument.
  const createTsconfigChecker = (tsconfig: string): ComponentMetaChecker => {
    if (!createCheckerBase) {
      return createChecker(tsconfig, CHECKER_OPTIONS);
    }
    const configPath = slash(tsconfig);
    return createCheckerBase(
      typescript,
      () => readVueTsconfig(typescript, configPath),
      CHECKER_OPTIONS,
      posix.dirname(configPath)
    );
  };

  const createInferredChecker = (): ComponentMetaChecker => {
    if (!createCheckerBase) {
      return createCheckerByJson(
        getProjectRoot(),
        { compilerOptions: INFERRED_COMPILER_OPTIONS, include: [] },
        CHECKER_OPTIONS
      );
    }
    const rootDir = slash(getProjectRoot());
    return createCheckerBase(
      typescript,
      () => readInferredConfig(typescript, rootDir),
      CHECKER_OPTIONS,
      rootDir
    );
  };

  return {
    parseCommandLine: (tsconfig) => {
      const [commandLine, fileNames] = readVueTsconfig(typescript, tsconfig);
      return {
        ...commandLine,
        // Same workaround as React's `parseTsconfigCommandLine`: neutralize outDir, then normalize
        // separators for the manager's path comparisons.
        // fix https://github.com/johnsoncodehk/volar/issues/1786
        // https://github.com/microsoft/TypeScript/issues/30457
        options: { ...commandLine.options, outDir: undefined },
        fileNames: fileNames.map(slash),
      };
    },
    createConfiguredProject: (commandLine, tsconfig, getCommandLine) =>
      new VueComponentMetaProject(
        createTsconfigChecker(tsconfig),
        commandLine,
        tsconfig,
        getCommandLine
      ),
    createInferredProject: () =>
      new VueComponentMetaProject(
        createInferredChecker(),
        { options: {}, fileNames: [], errors: [] },
        undefined
      ),
  };
}

export class VueComponentMetaManager extends ComponentMetaManager<
  VueComponentMetaProject,
  ts.ParsedCommandLine
> {
  constructor(
    public readonly typeScriptModule: typeof ts,
    createCheckerBase?: CreateCheckerBase
  ) {
    const typescript = typeScriptModule;
    super(typescript, createVueProjectFactory(typescript, createCheckerBase));
  }

  /**
   * Checker for the tsconfig project that covers `componentPath`, with that file guaranteed
   * present and fresh. Extraction only ever feeds the checker the component file — the story file
   * is parsed separately with babel and never enters the TS program.
   */
  getCheckerForFile(componentPath: string): ComponentMetaChecker {
    const project = this.getProjectForFile(componentPath);
    project.ensureFiles([componentPath]);
    project.ensureFresh([componentPath]);
    return project.checker;
  }

  /** Post-extraction heap check; Vue has no batch surface, so callers invoke this per payload. */
  recycleIfHeapPressured(): void {
    this.recycleProjectsIfHeapPressured();
  }
}

function tryReadFile(fileName: string): string | undefined {
  try {
    return readFileSync(fileName, 'utf8');
  } catch {
    return undefined;
  }
}

function statMtime(fileName: string): number | undefined {
  try {
    return statSync(fileName).mtimeMs;
  } catch {
    return undefined;
  }
}
