import { normalize } from 'pathe';
import { vi } from 'vitest';

import { getService } from '../../shared/open-service/server.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
import { ModuleGraphEngine } from '../../shared/open-service/services/module-graph/engine/module-graph-engine.ts';
import type { ModuleGraphStatus } from '../../shared/open-service/services/module-graph/types.ts';
import type { QueryState } from '../../shared/open-service/types.ts';

/** Wraps a value as a settled `success`/`idle` {@link QueryState}, mirroring a real subscription emission. */
function toSuccessState<TData>(data: TData): QueryState<TData> {
  return {
    data,
    error: undefined,
    status: 'success',
    loadStatus: 'idle',
    isPending: false,
    isSuccess: true,
    isError: false,
    isLoading: false,
    isInitialLoading: false,
    isRefreshing: false,
  };
}
import {
  errorToErrorLike,
  toStoryIndexPath,
} from '../../shared/open-service/services/module-graph/types.ts';
import { ChangeDetectionService } from './change-detection-service.ts';

export {
  createDeferred,
  createMockAdapter,
  createStoryIndex,
  buildReverseIndex,
  installDependencyGraphMocks,
  type MockAdapterHandle,
} from '../../shared/open-service/services/module-graph/module-graph.test-helpers.ts';

type ChangeDetectionServiceOptions = ConstructorParameters<typeof ChangeDetectionService>[0];

/**
 * Installs a `getService('core/module-graph')` mock backed by a real {@link ModuleGraphEngine}
 * instance (for tests that call `graph.start(adapter)`).
 */
export function installModuleGraphQueryMock(engine: ModuleGraphEngine) {
  let status: ModuleGraphStatus = engine.hasGraph() ? { value: 'ready' } : { value: 'booting' };
  let graphRevision = 0;
  let latestChangedStoryFiles: string[] = [];
  const statusSubscribers = new Set<(next: QueryState<ModuleGraphStatus>) => void>();
  const revisionSubscribers = new Set<(next: QueryState<number>) => void>();
  const emitStatus = () => {
    statusSubscribers.forEach((subscriber) => subscriber(toSuccessState(status)));
  };
  const emitRevision = () => {
    revisionSubscribers.forEach((subscriber) => subscriber(toSuccessState(graphRevision)));
  };
  const storiesForFiles = ({ files }: { files: string[] }) =>
    files.map((file) => {
      const hits = engine.lookup(normalize(file));
      return [...hits.entries()].map(([storyFile, depth]) => ({
        storyFile: toStoryIndexPath(storyFile, '/repo'),
        depth,
      }));
    });

  vi.mocked(getService).mockReturnValue({
    queries: {
      status: {
        get: () => status,
        loaded: async () => {
          await engine.whenSettled();
          return status;
        },
        subscribe: vi.fn(
          (_input: undefined, callback: (next: QueryState<ModuleGraphStatus>) => void) => {
            statusSubscribers.add(callback);
            callback(toSuccessState(status));
            return () => statusSubscribers.delete(callback);
          }
        ),
      },
      storiesForFiles: {
        get: storiesForFiles,
        loaded: async (input: { files: string[] }) => {
          await engine.whenSettled();
          return storiesForFiles(input);
        },
      },
      graphRevision: {
        get: () => 0,
        subscribe: vi.fn((_input: undefined, callback: (next: QueryState<number>) => void) => {
          revisionSubscribers.add(callback);
          callback(toSuccessState(graphRevision));
          return () => revisionSubscribers.delete(callback);
        }),
      },
      latestStoryChanges: {
        get: () => ({ revision: graphRevision, storyFiles: latestChangedStoryFiles }),
        subscribe: vi.fn(() => () => undefined),
      },
    },
  } as unknown as ModuleGraphService);

  return {
    applySnapshot: () => {
      // The snapshot marks the graph ready but is the revision baseline, not a change.
      status = { value: 'ready' };
      emitStatus();
    },
    applyUpdate: (bumpedStoryFiles: string[] = []) => {
      // Out-of-graph changes bump no stories, so they must not advance the revision.
      if (bumpedStoryFiles.length === 0) {
        return;
      }
      graphRevision += 1;
      latestChangedStoryFiles = bumpedStoryFiles;
      emitRevision();
    },
    bumpGraphRevision: () => {
      graphRevision += 1;
      emitRevision();
    },
    applyError: (error: Error) => {
      status = { value: 'error', error: errorToErrorLike(error) };
      emitStatus();
    },
    applyUnavailable: (reason: string, error?: Error) => {
      status = {
        value: 'unavailable',
        reason,
        ...(error ? { error: errorToErrorLike(error) } : {}),
      };
      emitStatus();
    },
  };
}

/**
 * Constructs {@link ChangeDetectionService} with lifecycle hooks wired to a
 * {@link ModuleGraphEngine}, matching dev-server behaviour for integration-style tests.
 */
export function createWiredChangeDetection(
  options: Omit<ChangeDetectionServiceOptions, 'graph'>,
  graphOptions?: { withoutStartupFailure?: boolean }
): {
  service: ChangeDetectionService;
  graph: ModuleGraphEngine;
  moduleGraphMock: ReturnType<typeof installModuleGraphQueryMock>;
} {
  const moduleGraphMockRef: { current?: ReturnType<typeof installModuleGraphQueryMock> } = {};
  const graph = new ModuleGraphEngine({
    getIndex: async () => {
      const storyIndexGenerator = await options.storyIndexGeneratorPromise;
      return storyIndexGenerator.getIndex();
    },
    workingDir: options.workingDir,
    onSnapshot: () => moduleGraphMockRef.current?.applySnapshot(),
    onUpdate: ({ bumpedStoryFiles }) => moduleGraphMockRef.current?.applyUpdate(bumpedStoryFiles),
    onError: (error) => moduleGraphMockRef.current?.applyError(error),
    onUnavailable: (reason, error) => moduleGraphMockRef.current?.applyUnavailable(reason, error),
  });
  const service = new ChangeDetectionService(options);
  const moduleGraphMock = installModuleGraphQueryMock(graph);
  moduleGraphMockRef.current = moduleGraphMock;
  void graphOptions;
  return { service, graph, moduleGraphMock };
}
