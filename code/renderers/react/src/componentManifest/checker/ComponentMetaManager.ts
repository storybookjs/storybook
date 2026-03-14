/**
 * ComponentMetaManager — multi-project manager for component metadata extraction.
 *
 * Mirrors Volar LS's typescriptProject.ts:
 *
 * - ConfigProjects / inferredProject / rootTsConfigs / searchedDirs
 * - FindMatchTSConfig → prepareClosestRootCommandLine / findDirectIncludeTsconfig /
 *   findIndirectReferenceTsconfig / findTSConfig / getReferencesChains / getCommandLine
 * - GetOrCreateConfiguredProject / getOrCreateInferredProject
 * - SortTSConfigs / isFileInDir
 * - Config change handler (Created / Changed+Deleted dispose pattern)
 *
 * Plus our own file watching layer (fs.watch + debounce) since we're a standalone Node.js process,
 * not running inside an IDE.
 */
import { logger } from 'storybook/internal/node-logger';

import { type FSWatcher, existsSync, watch } from 'fs';
import * as path from 'path';
import type ts from 'typescript';

import type { StoryRef } from '../getComponentImports';
import { groupByToMap } from '../utils';
import { ComponentMetaProject } from './ComponentMetaProject';

// Volar LS pattern (typescriptProject.ts line 18)
const rootTsConfigNames = ['tsconfig.json', 'jsconfig.json'];

const DEFAULT_INFERRED_OPTIONS: ts.CompilerOptions = {
  strict: true,
  esModuleInterop: true,
  allowJs: true,
  skipLibCheck: true,
};

export class ComponentMetaManager {
  // Volar LS pattern (typescriptProject.ts lines 34-37)
  private configProjects = new Map<string, ComponentMetaProject>();
  private inferredProject: ComponentMetaProject | undefined;
  private rootTsConfigs = new Set<string>();
  private searchedDirs = new Set<string>();

  // Our own file watching layer
  private watching = false;
  private watchersByDir = new Map<string, FSWatcher>();
  private pendingEvents = new Map<string, ReturnType<typeof setTimeout>>();

  // Volar Kit pattern (createChecker.ts line 83): module-level fsFileSnapshots
  readonly fsFileSnapshots = new Map<
    string,
    [number | undefined, ts.IScriptSnapshot | undefined]
  >();

  constructor(private typescript: typeof ts) {}

  // ---------------------------------------------------------------------------
  // Volar LS pattern: getLanguageService (typescriptProject.ts lines 70-79)
  // ---------------------------------------------------------------------------

  getProjectForFile(fileName: string): ComponentMetaProject {
    const tsconfig = this.findMatchTSConfig(fileName);
    if (tsconfig) {
      // Volar LS pattern (typescriptProject.ts lines 72-74):
      // Always go through getOrCreateConfiguredProject — never raw map lookup.
      return (
        this.getOrCreateConfiguredProject(tsconfig) ?? this.getOrCreateInferredProject(fileName)
      );
    }
    return this.getOrCreateInferredProject(fileName);
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
  }

  // ---------------------------------------------------------------------------
  // Volar LS pattern: findMatchTSConfig (typescriptProject.ts lines 101-234)
  // ---------------------------------------------------------------------------

  private findMatchTSConfig(filePath: string): string | null {
    const fileName = filePath.replace(/\\/g, '/');

    // Volar LS pattern (typescriptProject.ts lines 104-118): walk up directories
    let dir = path.dirname(fileName);
    while (true) {
      if (this.searchedDirs.has(dir)) {
        break;
      }
      this.searchedDirs.add(dir);
      for (const tsConfigName of rootTsConfigNames) {
        const tsconfigPath = path.join(dir, tsConfigName).replace(/\\/g, '/');
        if (this.typescript.sys.fileExists(tsconfigPath)) {
          this.rootTsConfigs.add(tsconfigPath);
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }

    if (this.rootTsConfigs.size === 0) {
      return null;
    }

    // Volar LS pattern: prepareClosestRootCommandLine (lines 124-138)
    // Side-effect only: pre-creates the closest project via getCommandLine() so that
    // findIndirectReferenceTsconfig below can inspect its project references.
    const prepareClosestRootCommandLine = () => {
      let matches: string[] = [];
      for (const rootTsConfig of this.rootTsConfigs) {
        if (isFileInDir(fileName, path.dirname(rootTsConfig))) {
          matches.push(rootTsConfig);
        }
      }
      matches = matches.sort((a, b) => sortTSConfigs(fileName, a, b));
      if (matches.length) {
        getCommandLine(matches[0]);
      }
    };

    // Volar LS pattern: findIndirectReferenceTsconfig (lines 139-148)
    const findIndirectReferenceTsconfig = () => {
      return findTSConfig((tsconfig) => {
        const project = this.configProjects.get(tsconfig);
        return !!project?.hasSourceFile(fileName);
      });
    };

    // Volar LS pattern: findDirectIncludeTsconfig (lines 149-158)
    const findDirectIncludeTsconfig = () => {
      return findTSConfig((tsconfig) => {
        const commandLine = getCommandLine(tsconfig);
        const fileNames = new Set(commandLine?.fileNames ?? []);
        return fileNames.has(fileName);
      });
    };

    // Volar LS pattern: findTSConfig (lines 160-188)
    const findTSConfig = (match: (tsconfig: string) => boolean): string | null => {
      const checked = new Set<string>();

      for (const rootTsConfig of [...this.rootTsConfigs].sort((a, b) =>
        sortTSConfigs(fileName, a, b)
      )) {
        const project = this.configProjects.get(rootTsConfig);
        if (project) {
          let chains = getReferencesChains(project.getCommandLine(), rootTsConfig, []);

          // This is to be consistent with tsserver behavior
          chains = chains.reverse();

          for (const chain of chains) {
            for (let i = chain.length - 1; i >= 0; i--) {
              const tsconfig = chain[i];

              if (checked.has(tsconfig)) {
                continue;
              }
              checked.add(tsconfig);

              if (match(tsconfig)) {
                return tsconfig;
              }
            }
          }
        }
      }

      return null;
    };

    // Volar LS pattern: getReferencesChains (lines 189-229)
    const getReferencesChains = (
      commandLine: ts.ParsedCommandLine,
      tsConfig: string,
      before: string[]
    ): string[][] => {
      if (commandLine.projectReferences?.length) {
        const newChains: string[][] = [];

        for (const projectReference of commandLine.projectReferences) {
          let tsConfigPath = projectReference.path.replace(/\\/g, '/');

          // fix https://github.com/johnsoncodehk/volar/issues/712
          if (this.typescript.sys.directoryExists(tsConfigPath)) {
            const newTsConfigPath = path.join(tsConfigPath, 'tsconfig.json');
            const newJsConfigPath = path.join(tsConfigPath, 'jsconfig.json');
            if (this.typescript.sys.fileExists(newTsConfigPath)) {
              tsConfigPath = newTsConfigPath;
            } else if (this.typescript.sys.fileExists(newJsConfigPath)) {
              tsConfigPath = newJsConfigPath;
            }
          }

          const beforeIndex = before.indexOf(tsConfigPath); // cycle
          if (beforeIndex >= 0) {
            newChains.push(before.slice(0, Math.max(beforeIndex, 1)));
          } else {
            const referenceCommandLine = getCommandLine(tsConfigPath);
            if (referenceCommandLine) {
              for (const chain of getReferencesChains(referenceCommandLine, tsConfigPath, [
                ...before,
                tsConfig,
              ])) {
                newChains.push(chain);
              }
            }
          }
        }

        return newChains;
      } else {
        return [[...before, tsConfig]];
      }
    };

    // Volar LS pattern: getCommandLine (lines 230-233)
    const getCommandLine = (tsConfig: string) => {
      const project = this.getOrCreateConfiguredProject(tsConfig);
      return project?.getCommandLine();
    };

    prepareClosestRootCommandLine();

    return findDirectIncludeTsconfig() ?? findIndirectReferenceTsconfig();
  }

  // ---------------------------------------------------------------------------
  // Volar LS pattern: getOrCreateConfiguredProject (lines 236-256)
  // ---------------------------------------------------------------------------

  private getOrCreateConfiguredProject(tsconfig: string): ComponentMetaProject | null {
    tsconfig = tsconfig.replace(/\\/g, '/');
    let project = this.configProjects.get(tsconfig);
    if (!project) {
      try {
        const getCommandLine = () => this.parseConfigWorker(tsconfig);
        project = new ComponentMetaProject(
          this.typescript,
          getCommandLine(),
          tsconfig,
          this.fsFileSnapshots,
          getCommandLine
        );
        this.configProjects.set(tsconfig, project);

        // Auto-watch the project's directories if watching is active.
        // This covers projects discovered after initial startWatching().
        if (this.watching) {
          this.watchDirectory(path.dirname(tsconfig));
          this.watchProgramSourceDirs(project);
        }
      } catch (err) {
        logger.debug(`[reactComponentMeta] Failed to parse tsconfig ${tsconfig}: ${err}`);
        return null;
      }
    }
    return project;
  }

  // ---------------------------------------------------------------------------
  // Volar LS pattern: getOrCreateInferredProject (lines 258-284)
  // ---------------------------------------------------------------------------

  private getOrCreateInferredProject(fileName: string): ComponentMetaProject {
    if (!this.inferredProject) {
      this.inferredProject = new ComponentMetaProject(
        this.typescript,
        {
          options: {
            ...DEFAULT_INFERRED_OPTIONS,
            target: this.typescript.ScriptTarget.Latest,
            module: this.typescript.ModuleKind.ESNext,
            moduleResolution: this.typescript.ModuleResolutionKind.Bundler,
            jsx: this.typescript.JsxEmit.ReactJSX,
          },
          fileNames: [],
          errors: [],
        },
        undefined,
        this.fsFileSnapshots
      );
    }

    this.inferredProject.ensureFiles([fileName]);

    return this.inferredProject;
  }

  // ---------------------------------------------------------------------------
  // Volar LS pattern: parseConfigWorker (typescriptProjectLs.ts lines 262-353)
  // ---------------------------------------------------------------------------

  private parseConfigWorker(tsconfig: string): ts.ParsedCommandLine {
    const config = this.typescript.readJsonConfigFile(tsconfig, this.typescript.sys.readFile);
    const content = this.typescript.parseJsonSourceFileConfigFileContent(
      config,
      this.typescript.sys,
      path.dirname(tsconfig),
      {},
      tsconfig
    );
    // fix https://github.com/johnsoncodehk/volar/issues/1786
    // https://github.com/microsoft/TypeScript/issues/30457
    content.options.outDir = undefined;
    content.fileNames = content.fileNames.map((fileName) => fileName.replace(/\\/g, '/'));
    return content;
  }

  // ---------------------------------------------------------------------------
  // File events
  // ---------------------------------------------------------------------------

  /**
   * Broadcast file changes to all projects. Each project selectively bumps projectVersion (Volar
   * Kit checker pattern).
   */
  onFilesChanged(changes: Array<{ filePath: string; type: 'changed' | 'created' | 'deleted' }>) {
    for (const project of this.configProjects.values()) {
      project.onFilesChanged(changes);
    }
    this.inferredProject?.onFilesChanged(changes);
  }

  /**
   * Volar LS pattern (typescriptProject.ts lines 43-68): Config change handler — Created /
   * (Changed||Deleted && has project).
   */
  onConfigChanged(configPath: string, type: 'created' | 'changed' | 'deleted') {
    configPath = configPath.replace(/\\/g, '/');
    if (type === 'created') {
      this.rootTsConfigs.add(configPath);
    } else if ((type === 'changed' || type === 'deleted') && this.configProjects.has(configPath)) {
      if (type === 'deleted') {
        this.rootTsConfigs.delete(configPath);
      }
      const project = this.configProjects.get(configPath);
      this.configProjects.delete(configPath);
      project?.dispose();
    }
    // Clear searchedDirs so findMatchTSConfig re-scans directories.
    // Without this, new tsconfigs in previously-scanned dirs would be invisible.
    this.searchedDirs.clear();
  }

  // ---------------------------------------------------------------------------
  // Our own file watching layer (no Volar equivalent — we're standalone)
  // ---------------------------------------------------------------------------

  startWatching(): void {
    if (this.watching) {
      return;
    }
    this.watching = true;

    // Retroactively create watchers for projects that were created before
    // watching was enabled (the first manifest request creates projects
    // eagerly, but startWatching() is only called once the manager is ready).
    for (const tsconfig of this.configProjects.keys()) {
      this.watchDirectory(path.dirname(tsconfig));
    }

    // Also watch directories containing source files resolved by the TS program.
    // This covers files reached via path aliases (e.g. monorepos where stories
    // live in apps/storybook/ but components live in packages/ui/).
    this.watchProgramSourceDirs();
  }

  /**
   * Watch directories that contain source files from all TS programs. This covers monorepo setups
   * where stories import components via path aliases (e.g. apps/storybook/ imports from
   * packages/ui/ via tsconfig paths).
   */
  private watchProgramSourceDirs(singleProject?: ComponentMetaProject): void {
    const dirs = new Set<string>();

    if (singleProject) {
      for (const filePath of singleProject.getSourceFilePaths()) {
        dirs.add(path.dirname(filePath));
      }
    } else {
      for (const project of this.configProjects.values()) {
        for (const filePath of project.getSourceFilePaths()) {
          dirs.add(path.dirname(filePath));
        }
      }
      if (this.inferredProject) {
        for (const filePath of this.inferredProject.getSourceFilePaths()) {
          dirs.add(path.dirname(filePath));
        }
      }
    }

    // Walk up from each source file dir to find package roots (package.json or tsconfig.json).
    // This avoids creating hundreds of individual watchers for each subdirectory.
    // Max 10 levels to prevent walking all the way to the filesystem root in edge cases.
    const MAX_WALK_DEPTH = 10;
    const roots = new Set<string>();
    for (const dir of dirs) {
      let candidate = dir;
      let depth = 0;
      while (candidate !== path.dirname(candidate) && depth < MAX_WALK_DEPTH) {
        depth++;
        // If already covered by an existing watcher, skip
        const normalized = candidate.replace(/\\/g, '/');
        let alreadyWatched = false;
        for (const watched of this.watchersByDir.keys()) {
          if (normalized === watched || normalized.startsWith(watched + '/')) {
            alreadyWatched = true;
            break;
          }
        }
        if (alreadyWatched) {
          break;
        }

        // Use package root as watch boundary
        if (
          this.typescript.sys.fileExists(path.join(candidate, 'package.json')) ||
          this.typescript.sys.fileExists(path.join(candidate, 'tsconfig.json'))
        ) {
          roots.add(candidate);
          break;
        }
        candidate = path.dirname(candidate);
      }
    }

    for (const root of roots) {
      this.watchDirectory(root);
    }
  }

  private watchDirectory(dir: string): void {
    if (!this.watching) {
      return;
    }

    const normalized = dir.replace(/\\/g, '/');

    for (const watched of this.watchersByDir.keys()) {
      // Already covered by an existing broader watcher
      if (normalized === watched || normalized.startsWith(watched + '/')) {
        return;
      }
    }

    // Close and remove narrower watchers that this broader directory subsumes.
    // The new recursive watcher covers them, so keeping both wastes file descriptors
    // and produces duplicate events.
    for (const [watched, watcher] of this.watchersByDir) {
      if (watched.startsWith(normalized + '/')) {
        watcher.close();
        this.watchersByDir.delete(watched);
      }
    }

    try {
      const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) {
          return;
        }
        const filePath = path.resolve(dir, filename).replace(/\\/g, '/');

        if (filePath.includes('/node_modules/') || filePath.includes('/.git/')) {
          return;
        }

        const existing = this.pendingEvents.get(filePath);
        if (existing) {
          clearTimeout(existing);
        }

        this.pendingEvents.set(
          filePath,
          setTimeout(() => {
            this.pendingEvents.delete(filePath);

            if (eventType === 'rename') {
              if (existsSync(filePath)) {
                this.handleFileEvent(filePath, 'created');
              } else {
                this.handleFileEvent(filePath, 'deleted');
              }
            } else {
              this.handleFileEvent(filePath, 'changed');
            }
          }, 50)
        );
      });
      watcher.unref();
      this.watchersByDir.set(normalized, watcher);
    } catch (err) {
      logger.debug(`[reactComponentMeta] Failed to watch directory ${normalized}: ${err}`);
    }
  }

  stopWatching(): void {
    for (const timeout of this.pendingEvents.values()) {
      clearTimeout(timeout);
    }
    this.pendingEvents.clear();
    for (const watcher of this.watchersByDir.values()) {
      watcher.close();
    }
    this.watchersByDir.clear();
    this.watching = false;
  }

  /**
   * Map raw fs.watch events to LSP-style FileChangeType before broadcasting.
   *
   * Fs.watch reports atomic saves (sed -i, editors) as `rename` → we classify as `created` (file
   * exists after rename). But an IDE/LSP would report an atomic save of an _existing_ file as
   * `Changed`, not `Created`.
   *
   * We reclassify here so that onFilesChanged stays 1:1 with Volar Kit.
   */
  private handleFileEvent(filePath: string, type: 'created' | 'changed' | 'deleted') {
    // Reclassify: atomic save of tracked file → 'changed' (LSP Changed)
    if (type === 'created') {
      for (const project of this.configProjects.values()) {
        if (project.hasSourceFile(filePath)) {
          type = 'changed';
          break;
        }
      }
      if (type === 'created' && this.inferredProject?.hasSourceFile(filePath)) {
        type = 'changed';
      }
    }

    const basename = path.basename(filePath);
    if (rootTsConfigNames.includes(basename)) {
      this.onConfigChanged(filePath, type);
      return;
    }

    this.onFilesChanged([{ filePath, type }]);
  }

  dispose() {
    this.stopWatching();
    for (const project of this.configProjects.values()) {
      project.dispose();
    }
    this.inferredProject?.dispose();
    this.configProjects.clear();
    this.inferredProject = undefined;
    this.fsFileSnapshots.clear();
    this.searchedDirs.clear();
    this.rootTsConfigs.clear();
  }
}

// Volar LS pattern (typescriptProject.ts lines 365-385)
export function sortTSConfigs(file: string, a: string, b: string) {
  const inA = isFileInDir(file, path.dirname(a));
  const inB = isFileInDir(file, path.dirname(b));

  if (inA !== inB) {
    const aWeight = inA ? 1 : 0;
    const bWeight = inB ? 1 : 0;
    return bWeight - aWeight;
  }

  const aLength = a.split('/').length;
  const bLength = b.split('/').length;

  if (aLength === bLength) {
    const aWeight = path.basename(a) === 'tsconfig.json' ? 1 : 0;
    const bWeight = path.basename(b) === 'tsconfig.json' ? 1 : 0;
    return bWeight - aWeight;
  }

  return bLength - aLength;
}

// Volar LS pattern (typescriptProject.ts lines 387-390)
export function isFileInDir(fileName: string, dir: string) {
  const relative = path.relative(dir, fileName);
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
