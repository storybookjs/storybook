import { logger } from 'storybook/internal/node-logger';
import type { DocgenError } from 'storybook/internal/types';

import { stat } from 'node:fs/promises';
import { relative } from 'node:path';

import { errorMessage } from '../utils.ts';
import { buildTagIndex, type TagIndex } from './build-tag-index.ts';
import { flattenInheritance } from './flatten-inheritance.ts';
import { isFailedManifest, loadManifest, type FailedManifest } from './load-manifest.ts';
import type { ManifestDeclaration } from './types.ts';

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
  paths: string[];
}

interface CemEntry {
  path: string;
  tags: TagIndex;
}

interface CemState {
  absolutePath: string;
  path: string;
  mtimeMs?: number;
  entry?: CemEntry;
  error?: DocgenError;
  // Last warning logged for this path; a repeat is not logged again.
  lastWarning?: string;
}

export class CemManager {
  private states: CemState[];

  private current?: Promise<CemSnapshot>;

  private next?: Promise<CemSnapshot>;

  constructor(absolutePaths: string[]) {
    this.states = absolutePaths.map((absolutePath) => ({
      absolutePath,
      path: relative(process.cwd(), absolutePath),
    }));
  }

  refresh(): Promise<CemSnapshot> {
    if (!this.current) {
      this.current = this.refreshStates().finally(() => {
        this.current = undefined;
      });
      return this.current;
    }

    // The running pass may have stat-ed before this caller's write landed.
    this.next ??= this.current.then(
      () => {
        this.next = undefined;
        return this.refresh();
      },
      () => {
        this.next = undefined;
        return this.refresh();
      }
    );
    return this.next;
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
          ...state,
          mtimeMs: undefined,
          entry: undefined,
          error: notFound,
        };
        this.warnOnce(nextState, notFound.message);
        return nextState;
      }
      return this.failedState(state, failureFromError(state.path, error), undefined);
    }
  }

  private async loadChangedManifest(state: CemState, mtimeMs: number): Promise<CemState> {
    const loaded = await loadManifest(state.absolutePath);
    if (isFailedManifest(loaded)) {
      return this.failedState(state, loaded.error, mtimeMs);
    }

    const entry: CemEntry = {
      path: loaded.path,
      tags: buildTagIndex(flattenInheritance(loaded.manifest)),
    };
    const nextState: CemState = {
      ...state,
      mtimeMs,
      entry,
      error: undefined,
      lastWarning: undefined,
    };
    logger.debug(`Loaded Custom Elements Manifest ${loaded.path}`);
    return nextState;
  }

  private failedState(state: CemState, error: DocgenError, mtimeMs: number | undefined): CemState {
    const nextState: CemState = {
      ...state,
      mtimeMs,
      error,
    };
    this.warnOnce(nextState, state.entry ? staleWarning(error) : error.message);
    return nextState;
  }

  private warnOnce(state: CemState, message: string): void {
    if (state.lastWarning === message) {
      return;
    }
    state.lastWarning = message;
    logger.warn(message);
  }
}

function buildSnapshot(states: CemState[]): CemSnapshot {
  const tags = new Map<string, CemTag>();
  const errors: DocgenError[] = [];
  const paths = states.map(({ path }) => path);

  for (const state of states) {
    if (state.entry) {
      const warning = state.error ? staleWarning(state.error) : undefined;
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
