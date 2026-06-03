import { normalize } from 'pathe';
import { vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { getService } from '../../shared/open-service/server.ts';
import { moduleGraphServiceDef } from '../../shared/open-service/services/module-graph/definition.ts';
import type {
  ChangeDetectionAdapter,
  FileChangeEvent,
} from '../../shared/open-service/services/module-graph/engine/adapters/index.ts';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ReverseIndexImpl,
} from '../../shared/open-service/services/module-graph/engine/dependency-graph/index.ts';
import { ModuleGraphEngine } from '../../shared/open-service/services/module-graph/engine/ModuleGraphEngine.ts';
import { ChangeDetectionService } from './ChangeDetectionService.ts';

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
export function installModuleGraphQueryMock(engine: ModuleGraphEngine): void {
  vi.mocked(getService).mockReturnValue({
    queries: {
      getReady: Object.assign(() => engine.hasGraph(), {
        loaded: async () => {
          await engine.whenSettled();
        },
        subscribe: vi.fn(() => () => undefined),
      }),
      getStoriesForFiles: ({ files }: { files: string[] }) =>
        files.map((file) => {
          const hits = engine.lookup(normalize(file));
          return [...hits.entries()].map(([storyFile, depth]) => ({ storyFile, depth }));
        }),
      getGraphRevision: Object.assign(() => 0, {
        subscribe: vi.fn(() => () => undefined),
      }),
      getAllStoryVersions: Object.assign(() => ({}), {
        subscribe: vi.fn(() => () => undefined),
      }),
      getStoryVersion: () => 0,
    },
  } as ReturnType<typeof getService<typeof moduleGraphServiceDef>>);
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
} {
  const ref: { current?: ChangeDetectionService } = {};
  const graph = new ModuleGraphEngine({
    storyIndexGeneratorPromise: options.storyIndexGeneratorPromise,
    workingDir: options.workingDir,
    onReady: () => ref.current?.onGraphReady(),
    onChange: () => ref.current?.onGraphChange(),
    onError: (error) => ref.current?.onGraphError(error),
    onUnavailable: (reason, error) => ref.current?.onGraphUnavailable(reason, error),
  });
  const service = new ChangeDetectionService(options);
  ref.current = service;
  installModuleGraphQueryMock(graph);
  void graphOptions;
  return { service, graph };
}
