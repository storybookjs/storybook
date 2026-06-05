import { vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import type { ChangeDetectionAdapter, FileChangeEvent } from './adapters/index.ts';
import { ChangeDetectionService } from './ChangeDetectionService.ts';
import {
  ChangeDetectionResolverFactory,
  DependencyGraphBuilder,
  IncrementalPatcher,
  ReverseIndexImpl,
} from './dependency-graph/index.ts';
import { StoryDependencyGraphService } from './StoryDependencyGraphService.ts';

type ChangeDetectionServiceOptions = ConstructorParameters<typeof ChangeDetectionService>[0];

/**
 * Shared scaffolding for the change-detection unit tests. The dependency-graph constructors are
 * mocked per test file (each file declares its own `vi.mock('./dependency-graph/index.ts', ...)`);
 * these helpers drive those mocks and build synthetic adapters / indexes / reverse indexes.
 */

export function createDeferred<T>() {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

export function createStoryIndex(
  entries: Array<{ storyId: string; importPath: string; title?: string; name?: string }>
): StoryIndex {
  return {
    v: 5,
    entries: Object.fromEntries(
      entries.map(({ storyId, importPath, title = 'Story', name = 'Default' }) => [
        storyId,
        {
          id: storyId,
          type: 'story',
          subtype: 'story',
          title,
          name,
          importPath,
        },
      ])
    ),
  };
}

export interface MockAdapterHandle {
  adapter: ChangeDetectionAdapter;
  emitFileChange: (event: FileChangeEvent) => void;
  emitStartupFailure: (event: { reason: string; error?: Error }) => void;
  hasFileChangeSubscriber: () => boolean;
  hasStartupFailureSubscriber: () => boolean;
}

/**
 * Constructs a {@link StoryDependencyGraphService} wired to a {@link ChangeDetectionService} the
 * same way the dev-server does: the graph is always injected, and its lifecycle callbacks are
 * routed to the service's `onGraph*` handlers. Tests drive `graph.start(adapter)` and
 * `service.start(adapter, enabled)` themselves (to keep timing control) and dispose both.
 */
export function createWiredChangeDetection(options: Omit<ChangeDetectionServiceOptions, 'graph'>): {
  service: ChangeDetectionService;
  graph: StoryDependencyGraphService;
} {
  const ref: { current?: ChangeDetectionService } = {};
  const graph = new StoryDependencyGraphService({
    storyIndexGeneratorPromise: options.storyIndexGeneratorPromise,
    workingDir: options.workingDir,
    onReady: () => ref.current?.onGraphReady(),
    onChange: () => ref.current?.onGraphChange(),
    onError: (error) => ref.current?.onGraphError(error),
    onUnavailable: (reason, error) => ref.current?.onGraphUnavailable(reason, error),
  });
  const service = new ChangeDetectionService({ ...options, graph });
  ref.current = service;
  return { service, graph };
}

export function createMockAdapter(opts?: {
  resolveConfig?: { projectRoot?: string };
  withoutStartupFailure?: boolean;
}): MockAdapterHandle {
  const fileHandlers = new Set<(e: FileChangeEvent) => void>();
  const startupHandlers = new Set<(e: { reason: string; error?: Error }) => void>();

  const adapter: ChangeDetectionAdapter = {
    async getResolveConfig() {
      return {
        projectRoot: opts?.resolveConfig?.projectRoot ?? '/repo',
      };
    },
    onFileChange(handler) {
      fileHandlers.add(handler);
      return () => fileHandlers.delete(handler);
    },
  };

  if (!opts?.withoutStartupFailure) {
    adapter.onStartupFailure = (handler) => {
      startupHandlers.add(handler);
      return () => startupHandlers.delete(handler);
    };
  }

  return {
    adapter,
    emitFileChange: (event) => {
      fileHandlers.forEach((h) => h(event));
    },
    emitStartupFailure: (event) => {
      startupHandlers.forEach((h) => h(event));
    },
    hasFileChangeSubscriber: () => fileHandlers.size > 0,
    hasStartupFailureSubscriber: () => startupHandlers.size > 0,
  };
}

/**
 * Build a ReverseIndexImpl populated with the given (dep -> story -> depth) entries.
 * Used by tests to control what `reverseIndex.lookup(changedFile)` returns.
 */
export function buildReverseIndex(
  edges: Iterable<readonly [string, string, number]>
): ReverseIndexImpl {
  const reverseIndex = new ReverseIndexImpl();
  for (const [dep, story, depth] of edges) {
    reverseIndex.record(dep, story, depth);
  }
  return reverseIndex;
}

/**
 * Stub the dependency-graph constructors so the service under test uses an in-test
 * ReverseIndexImpl + an inert IncrementalPatcher. The mock implementations must be regular
 * `function`s, not arrow functions: the service calls them with `new`, which arrow functions do
 * not support.
 */
export function installDependencyGraphMocks(reverseIndex: ReverseIndexImpl): {
  patchSpy: ReturnType<typeof vi.fn>;
  buildSpy: ReturnType<typeof vi.fn>;
} {
  const patchSpy = vi.fn(async () => undefined);
  const buildSpy = vi.fn(async () => ({ reverseIndex, graph: new Map() }));

  vi.mocked(ChangeDetectionResolverFactory).mockImplementation(function () {
    return {
      resolve: vi.fn(async () => null),
    } as unknown as ChangeDetectionResolverFactory;
  } as unknown as new () => ChangeDetectionResolverFactory);
  vi.mocked(DependencyGraphBuilder).mockImplementation(function () {
    return { build: buildSpy } as unknown as DependencyGraphBuilder;
  } as unknown as new () => DependencyGraphBuilder);
  vi.mocked(IncrementalPatcher).mockImplementation(function () {
    return { patch: patchSpy } as unknown as IncrementalPatcher;
  } as unknown as new () => IncrementalPatcher);

  return { patchSpy, buildSpy };
}
