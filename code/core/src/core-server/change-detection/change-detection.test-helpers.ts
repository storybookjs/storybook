import { normalize } from 'pathe';
import { vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { getService } from '../../shared/open-service/server.ts';
import { moduleGraphServiceDef } from '../../shared/open-service/services/module-graph/definition.ts';
import type {
  ChangeDetectionAdapter,
  FileChangeEvent,
} from '../../shared/open-service/services/module-graph/engine/adapters/types.ts';
import { DependencyGraphBuilder } from '../../shared/open-service/services/module-graph/engine/dependency-graph/dependency-graph-builder.ts';
import { IncrementalPatcher } from '../../shared/open-service/services/module-graph/engine/dependency-graph/incremental-patcher.ts';
import { ChangeDetectionResolverFactory } from '../../shared/open-service/services/module-graph/engine/dependency-graph/resolver-factory.ts';
import { ReverseIndexImpl } from '../../shared/open-service/services/module-graph/engine/dependency-graph/reverse-index.ts';
import { ModuleGraphEngine } from '../../shared/open-service/services/module-graph/engine/module-graph-engine.ts';
import type { ModuleGraphStatus } from '../../shared/open-service/services/module-graph/types.ts';
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
  let status: ModuleGraphStatus = engine.hasGraph() ? { status: 'ready' } : { status: 'booting' };
  let graphRevision = 0;
  const statusSubscribers = new Set<(next: ModuleGraphStatus) => void>();
  const revisionSubscribers = new Set<(next: number) => void>();
  const emitStatus = () => {
    statusSubscribers.forEach((subscriber) => subscriber(status));
  };
  const emitRevision = () => {
    revisionSubscribers.forEach((subscriber) => subscriber(graphRevision));
  };
  const getStoriesForFiles = ({ files }: { files: string[] }) =>
    files.map((file) => {
      const hits = engine.lookup(normalize(file));
      return [...hits.entries()].map(([storyFile, depth]) => ({
        storyFile: toStoryIndexPath(storyFile, '/repo'),
        depth,
      }));
    });

  vi.mocked(getService).mockReturnValue({
    queries: {
      getStatus: Object.assign(() => status, {
        loaded: async () => {
          await engine.whenSettled();
          return status;
        },
        subscribe: vi.fn((_input: undefined, callback: (next: ModuleGraphStatus) => void) => {
          statusSubscribers.add(callback);
          callback(status);
          return () => statusSubscribers.delete(callback);
        }),
      }),
      getStoriesForFiles: Object.assign(getStoriesForFiles, {
        loaded: async (input: { files: string[] }) => {
          await engine.whenSettled();
          return getStoriesForFiles(input);
        },
      }),
      getGraphRevision: Object.assign(() => 0, {
        subscribe: vi.fn((_input: undefined, callback: (next: number) => void) => {
          revisionSubscribers.add(callback);
          callback(graphRevision);
          return () => revisionSubscribers.delete(callback);
        }),
      }),
      getAllStoryVersions: Object.assign(() => ({}), {
        subscribe: vi.fn(() => () => undefined),
      }),
      getStoryVersion: () => 0,
    },
  } as unknown as ReturnType<typeof getService<typeof moduleGraphServiceDef>>);

  return {
    applySnapshot: () => {
      status = { status: 'ready' };
      graphRevision += 1;
      emitStatus();
      emitRevision();
    },
    applyUpdate: () => {
      graphRevision += 1;
      emitRevision();
    },
    bumpGraphRevision: () => {
      graphRevision += 1;
      emitRevision();
    },
    applyError: (error: Error) => {
      status = { status: 'error', error: errorToErrorLike(error) };
      emitStatus();
    },
    applyUnavailable: (reason: string, error?: Error) => {
      status = {
        status: 'unavailable',
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
  let moduleGraphMock!: ReturnType<typeof installModuleGraphQueryMock>;
  const graph = new ModuleGraphEngine({
    getIndex: async () => {
      const storyIndexGenerator = await options.storyIndexGeneratorPromise;
      return storyIndexGenerator.getIndex();
    },
    workingDir: options.workingDir,
    onSnapshot: () => moduleGraphMock.applySnapshot(),
    onUpdate: () => moduleGraphMock.applyUpdate(),
    onStoryIndexInvalidated: () => moduleGraphMock.bumpGraphRevision(),
    onError: (error) => moduleGraphMock.applyError(error),
    onUnavailable: (reason, error) => moduleGraphMock.applyUnavailable(reason, error),
  });
  const service = new ChangeDetectionService(options);
  moduleGraphMock = installModuleGraphQueryMock(graph);
  void graphOptions;
  return { service, graph, moduleGraphMock };
}
