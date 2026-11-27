import { statSync } from 'node:fs';

import { slash } from 'storybook/internal/common';
import {
  ComponentMetaManager,
  type ComponentMetaProjectBase,
  type ComponentMetaProjectFactory,
  type FileChange,
  filterSourceFilePaths,
} from 'storybook/internal/component-meta';

import ts from 'typescript';

import {
  type Docgen,
  type DocgenCache,
  type DocgenOptions,
  type SvelteCommandLine,
  assertCompilerApi,
  createDocgenCache,
  createDocgenProgram,
  extractDocgen,
  inferredCommandLine,
  parseSvelteConfig,
  virtualFileName,
} from '../svelte2tsx/generate-docgen.ts';

// The root set is the config's `.svelte` files plus the svelte2tsx shim, not only the requested ones:
// types a component reads from another component, such as the events it forwards, resolve only when
// that component is part of the program.
export class SvelteDocgenProject implements ComponentMetaProjectBase {
  private program: ts.Program | undefined;
  private stale = true;
  private rootsStale = false;
  // A created or deleted file can satisfy, or break, an import the old program failed to resolve.
  private resolutionsStale = false;
  // Requested components the config does not include.
  private extraRoots: string[] = [];

  private commandLine: SvelteCommandLine;
  private readonly cache: DocgenCache;
  private readonly getCommandLineFn?: () => SvelteCommandLine;

  constructor(
    commandLine: SvelteCommandLine,
    cache: DocgenCache,
    getCommandLineFn?: () => SvelteCommandLine
  ) {
    this.commandLine = commandLine;
    this.cache = cache;
    this.getCommandLineFn = getCommandLineFn;
  }

  // Re-read after a file is created or deleted, because the component-meta manager matches files
  // against it.
  getCommandLine(): SvelteCommandLine {
    if (this.rootsStale && this.getCommandLineFn) {
      this.commandLine = this.getCommandLineFn();
      this.extraRoots = this.extraRoots.filter(
        (root) => !this.commandLine.rootNames.includes(root)
      );
    }
    this.rootsStale = false;
    return this.commandLine;
  }

  hasSourceFile(fileName: string): boolean {
    return !!this.program?.getSourceFile(virtualFileName(slash(fileName)));
  }

  ensureFiles(fileNames: string[]): void {
    for (const fileName of fileNames.map((name) => virtualFileName(slash(name)))) {
      if (!this.commandLine.rootNames.includes(fileName) && !this.extraRoots.includes(fileName)) {
        this.extraRoots.push(fileName);
        this.stale = true;
      }
    }
  }

  onFilesChanged(changes: FileChange[]): void {
    for (const { filePath, type } of changes) {
      if (type !== 'changed') {
        this.rootsStale = true;
        this.resolutionsStale = true;
        this.stale = true;
      } else if (this.hasSourceFile(filePath) || this.program?.getSourceFile(slash(filePath))) {
        this.stale = true;
      }
    }
  }

  getSourceFilePaths(): string[] {
    return filterSourceFilePaths(
      this.getProgram()
        .getSourceFiles()
        .map((sourceFile) => sourceFile.fileName)
    );
  }

  dispose(): void {
    this.program = undefined;
    this.stale = true;
  }

  docgen(componentPath: string, options: DocgenOptions): Docgen {
    this.ensureFiles([componentPath]);
    this.ensureFresh(componentPath);
    const program = this.getProgram();
    return extractDocgen(
      program,
      program.getTypeChecker(),
      virtualFileName(componentPath),
      options
    );
  }

  // Catches a save the watcher has not reported yet: its events arrive debounced.
  private ensureFresh(componentPath: string): void {
    const cached = this.cache.filenameToModifiedTime[virtualFileName(slash(componentPath))];
    if (cached?.getTime() !== statMtime(componentPath)) {
      this.stale = true;
    }
  }

  private getProgram(): ts.Program {
    const commandLine = this.getCommandLine();
    if (!this.program || this.stale) {
      this.program = createDocgenProgram(
        [...commandLine.rootNames, ...this.extraRoots],
        commandLine.options,
        this.cache,
        this.resolutionsStale ? undefined : this.program
      );
      this.resolutionsStale = false;
      this.stale = false;
    }
    return this.program;
  }
}

function statMtime(fileName: string): number | undefined {
  try {
    return statSync(fileName).mtime.getTime();
  } catch {
    return undefined;
  }
}

function createSvelteProjectFactory(
  cache: DocgenCache
): ComponentMetaProjectFactory<SvelteDocgenProject, SvelteCommandLine> {
  return {
    parseCommandLine: (tsconfig) => parseSvelteConfig(tsconfig),
    createConfiguredProject: (commandLine, _tsconfig, getCommandLine) =>
      new SvelteDocgenProject(commandLine, cache, getCommandLine),
    createInferredProject: () => new SvelteDocgenProject(inferredCommandLine(), cache),
    recycle: () => Object.assign(cache, createDocgenCache()),
    dispose: () => Object.assign(cache, createDocgenCache()),
  };
}

export class SvelteComponentMetaManager extends ComponentMetaManager<
  SvelteDocgenProject,
  SvelteCommandLine
> {
  constructor() {
    assertCompilerApi();
    super(ts, createSvelteProjectFactory(createDocgenCache()));
  }

  generateDocgen(componentPath: string, options: DocgenOptions): Docgen {
    const docgen = this.getProjectForFile(componentPath).docgen(componentPath, options);
    this.recycleProjectsIfHeapPressured();
    return docgen;
  }
}
