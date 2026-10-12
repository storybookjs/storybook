import { isInNodeModules } from 'storybook/internal/common';
import {
  type ComponentMetaProjectBase,
  type FileChange,
  filterSourceFilePaths,
} from 'storybook/internal/component-meta';
import { logger } from 'storybook/internal/node-logger';

import type * as ts from '@typescript/typescript6';
import { dirname, join, normalize } from 'pathe';

import type { ManifestPackage } from '../manifest/types.ts';
import type { GeneratorAdapter } from './generator.ts';

interface FileImports {
  mtime: number | undefined;
  imports: string[];
}

export class GeneratorProject implements ComponentMetaProjectBase {
  private readonly importsByFile = new Map<string, FileImports>();
  private rootsStale = false;
  private revisionCount = 0;

  constructor(
    private readonly typescript: typeof ts,
    private readonly generator: GeneratorAdapter,
    private commandLine: ts.ParsedCommandLine,
    public readonly configFileName: string | undefined,
    private readonly getCommandLineFn?: () => ts.ParsedCommandLine
  ) {}

  /** Moves on every file event, so callers can tell whether a cached miss is still valid. */
  get revision(): number {
    return this.revisionCount;
  }

  getCommandLine(): ts.ParsedCommandLine {
    if (this.rootsStale && this.getCommandLineFn) {
      this.commandLine = this.getCommandLineFn();
    }
    this.rootsStale = false;
    return this.commandLine;
  }

  rootFileNames(): string[] {
    return this.getCommandLine().fileNames;
  }

  hasSourceFile(fileName: string): boolean {
    const normalized = normalize(fileName);
    return this.importsByFile.has(normalized) || this.rootFileNames().includes(normalized);
  }

  ensureFiles(fileNames: string[]): void {
    for (const fileName of fileNames.map(normalize)) {
      if (!this.commandLine.fileNames.includes(fileName)) {
        this.commandLine.fileNames.push(fileName);
      }
    }
  }

  getSourceFilePaths(): string[] {
    return filterSourceFilePaths([
      ...new Set([...this.rootFileNames(), ...this.importsByFile.keys()]),
    ]);
  }

  onFilesChanged(changes: FileChange[]): void {
    for (const { filePath, type } of changes) {
      if (type === 'changed') {
        this.importsByFile.delete(normalize(filePath));
        continue;
      }
      // A created or deleted file can change how any import resolves.
      this.importsByFile.clear();
      this.rootsStale = true;
    }
    this.revisionCount++;
  }

  dispose(): void {
    this.importsByFile.clear();
  }

  createManifestForRoots(rootPaths: string[]): ManifestPackage | undefined {
    const roots = rootPaths.map(normalize);
    const closure = this.importClosure(roots);
    if (closure.length === 0) {
      this.debug(`none of ${rootPaths.join(', ')} could be read`);
      return undefined;
    }
    // TODO: pass a warm program once the generator accepts one; today it builds its own from
    // tsConfigPath on every call. Without a tsconfig it scans this directory, and the program
    // follows imports from there, so the roots' directory is enough.
    const tsConfigPath = this.configFileName ?? join(commonDirectory(roots), 'tsconfig.json');
    return this.generator.generate(tsConfigPath, closure);
  }

  private importClosure(roots: string[]): string[] {
    const closure = new Set<string>();
    const queue = [...roots];
    while (queue.length > 0) {
      const fileName = queue.pop()!;
      if (closure.has(fileName) || isInNodeModules(fileName)) {
        continue;
      }
      const imports = this.importsOf(fileName);
      if (!imports) {
        continue;
      }
      closure.add(fileName);
      queue.push(...imports);
    }
    return [...closure];
  }

  private importsOf(fileName: string): string[] | undefined {
    const { sys } = this.typescript;
    const mtime = sys.getModifiedTime?.(fileName)?.valueOf();
    const cached = this.importsByFile.get(fileName);
    if (cached && cached.mtime === mtime) {
      return cached.imports;
    }
    const text = sys.readFile(fileName);
    if (text === undefined) {
      this.importsByFile.delete(fileName);
      return undefined;
    }
    const { options } = this.getCommandLine();
    const imports = this.typescript
      .preProcessFile(text, true, true)
      .importedFiles.flatMap(
        ({ fileName: specifier }) =>
          this.typescript.resolveModuleName(specifier, fileName, options, sys).resolvedModule
            ?.resolvedFileName ?? []
      )
      .map(normalize);
    this.importsByFile.set(fileName, { mtime, imports });
    return imports;
  }

  private debug(message: string): void {
    logger.debug(
      `[web-components-cem] ${message}${this.configFileName ? ` (${this.configFileName})` : ''}`
    );
  }
}

function commonDirectory(fileNames: string[]): string {
  const [first, ...rest] = fileNames.map((fileName) => dirname(fileName).split('/'));
  let length = first.length;
  for (const segments of rest) {
    const mismatch = first
      .slice(0, length)
      .findIndex((segment, index) => segment !== segments[index]);
    if (mismatch !== -1) {
      length = mismatch;
    }
  }
  return first.slice(0, length).join('/') || '/';
}
