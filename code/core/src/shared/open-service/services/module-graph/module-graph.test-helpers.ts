import { vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { moduleGraphServiceDef } from './definition.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './engine/adapters/types.ts';
import { DependencyGraphBuilder } from './engine/dependency-graph/dependency-graph-builder.ts';
import { IncrementalPatcher } from './engine/dependency-graph/incremental-patcher.ts';
import { ChangeDetectionResolverFactory } from './engine/dependency-graph/resolver-factory.ts';
import { ReverseIndexImpl } from './engine/dependency-graph/reverse-index.ts';

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

export function buildReverseIndex(
  edges: Iterable<readonly [string, string, number]>
): ReverseIndexImpl {
  const reverseIndex = new ReverseIndexImpl();
  for (const [dep, story, depth] of edges) {
    reverseIndex.record(dep, story, depth);
  }
  return reverseIndex;
}

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

/** Registers module-graph for unit tests without a live engine (no-op settlement command). */
export function registerTestModuleGraphService(workingDir = process.cwd()) {
  return registerService(
    {
      ...moduleGraphServiceDef,
      initialState: {
        ...moduleGraphServiceDef.initialState,
        workingDir,
      },
    },
    {
      commands: {
        waitForSettledEngine: {
          handler: async () => undefined,
        },
      },
    }
  );
}
