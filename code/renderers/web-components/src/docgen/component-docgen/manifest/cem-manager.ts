import { logger } from 'storybook/internal/node-logger';
import type { DocgenError } from 'storybook/internal/types';

import { stat } from 'node:fs/promises';
import { relative } from 'node:path';

import { errorMessage } from '../utils.ts';
import { buildTagIndex, type TagIndex } from './build-tag-index.ts';
import { isFailedManifest, loadManifest, type FailedManifest } from './load-manifest.ts';
import type { ManifestDeclaration } from './types.ts';
import { validateManifest } from './validate-manifest.ts';

export interface CemTag {
  declaration: ManifestDeclaration;
  /** Path relative to `process.cwd()`, as shown in messages and payloads. */
  manifestPath: string;
  warning?: string;
}

export interface CemSnapshot {
  /** First manifest in configuration order wins a tag. */
  tags: ReadonlyMap<string, CemTag>;
  /** Manifests that contribute nothing: missing or invalid with no last valid version. */
  errors: DocgenError[];
  /** Relative paths of every configured manifest, for messages. */
  paths: string[];
}

interface CemEntry {
  path: string;
  tags: TagIndex;
  warning?: string;
}

interface CemState {
  absolutePath: string;
  path: string;
  /** Last observed mtime, whether the load succeeded or failed. */
  mtimeMs?: number;
  /** Last good index; together with `error` it means stale. */
  entry?: CemEntry;
  /** Missing (`manifest-not-found`) or invalid; without `entry` the manifest contributes nothing. */
  error?: DocgenError;
  lastLogged?: string;
}

export class CemManager {
  private states: CemState[];

  private refreshPromise?: Promise<CemSnapshot>;

  constructor(absolutePaths: string[]) {
    this.states = absolutePaths.map((absolutePath) => ({
      absolutePath,
      path: relative(process.cwd(), absolutePath),
    }));
  }

  /** Re-stats every path, reloads what changed, and shares concurrent refreshes. */
  refresh(): Promise<CemSnapshot> {
    this.refreshPromise ??= this.refreshStates().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async refreshStates(): Promise<CemSnapshot> {
    this.states = await Promise.all(this.states.map((state) => this.refreshState(state)));
    return buildSnapshot(this.states);
  }

  private async refreshState(state: CemState): Promise<CemState> {
    try {
      const stats = await stat(state.absolutePath);
      if (state.mtimeMs === stats.mtimeMs) {
        return state;
      }
      return await this.loadChangedManifest(state, stats.mtimeMs);
    } catch (error) {
      if (isNotFound(error)) {
        const notFound = missingManifestError(state.path);
        const nextState: CemState = {
          absolutePath: state.absolutePath,
          path: state.path,
          error: notFound,
          lastLogged: state.lastLogged,
        };
        this.warnOnce(nextState, notFound.message);
        return nextState;
      }
      return this.failedState(state, failureFromError(state.path, error), state.mtimeMs);
    }
  }

  private async loadChangedManifest(state: CemState, mtimeMs: number): Promise<CemState> {
    const loaded = await loadManifest(state.absolutePath);
    if (isFailedManifest(loaded)) {
      return this.failedState(state, loaded.error, mtimeMs);
    }

    const warning = warningForViolations(loaded.path, validateManifest(loaded.manifest));
    const entry: CemEntry = {
      path: loaded.path,
      tags: buildTagIndex(loaded.manifest),
      ...(warning ? { warning } : {}),
    };
    const nextState: CemState = {
      absolutePath: state.absolutePath,
      path: state.path,
      mtimeMs,
      entry,
      error: undefined,
      lastLogged: state.lastLogged,
    };
    this.debugOnce(nextState, `Loaded Custom Elements Manifest ${loaded.path}`);
    if (warning) {
      this.warnOnce(nextState, warning);
    }
    return nextState;
  }

  private failedState(state: CemState, error: DocgenError, mtimeMs: number | undefined): CemState {
    if (state.entry) {
      const nextState: CemState = {
        absolutePath: state.absolutePath,
        path: state.path,
        mtimeMs,
        entry: state.entry,
        error,
        lastLogged: state.lastLogged,
      };
      this.warnOnce(nextState, staleWarning(error));
      return nextState;
    }

    const nextState: CemState = {
      absolutePath: state.absolutePath,
      path: state.path,
      mtimeMs,
      error,
      lastLogged: state.lastLogged,
    };
    this.warnOnce(nextState, error.message);
    return nextState;
  }

  private warnOnce(state: CemState, message: string): void {
    if (state.lastLogged === message) {
      return;
    }
    state.lastLogged = message;
    logger.warn(message);
  }

  private debugOnce(state: CemState, message: string): void {
    if (state.lastLogged === message) {
      return;
    }
    state.lastLogged = message;
    logger.debug(message);
  }
}

function buildSnapshot(states: CemState[]): CemSnapshot {
  const tags = new Map<string, CemTag>();
  const errors: DocgenError[] = [];
  const paths = states.map(({ path }) => path);

  for (const state of states) {
    if (state.entry) {
      const warning = state.error ? staleWarning(state.error) : state.entry.warning;
      for (const [tag, declaration] of state.entry.tags) {
        if (!tags.has(tag)) {
          tags.set(tag, {
            declaration,
            manifestPath: state.entry.path,
            ...(warning ? { warning } : {}),
          });
        }
      }
      continue;
    }

    if (state.error) {
      errors.push(state.error);
    }
  }

  return {
    tags,
    errors,
    paths,
  };
}

function failureFromError(path: string, error: unknown): FailedManifest['error'] {
  return {
    name: 'manifest-invalid',
    message: `Invalid Custom Elements Manifest at ${path}: ${errorMessage(error)}`,
  };
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'ENOENT'
  );
}

function missingManifestError(path: string): DocgenError {
  return {
    name: 'manifest-not-found',
    message: `Custom Elements Manifest ${path} not found yet; docs load once the analyzer writes it`,
  };
}

function staleWarning(error: DocgenError): string {
  return `${error.message}; using the last valid version`;
}

function warningForViolations(path: string, violations: string[]): string | undefined {
  if (violations.length === 0) {
    return undefined;
  }
  return `${path} has ${violations.length} schema violation(s); first: ${violations
    .slice(0, 3)
    .join('; ')}`;
}
