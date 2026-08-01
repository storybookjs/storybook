import { vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { moduleGraphServiceDef, ModuleGraphServiceState } from './definition.ts';
import type { ChangeDetectionAdapter, FileChangeEvent } from './engine/adapters/types.ts';
import { DependencyGraphBuilder } from './engine/dependency-graph/dependency-graph-builder.ts';
import { IncrementalPatcher } from './engine/dependency-graph/incremental-patcher.ts';
import { ChangeDetectionResolverFactory } from './engine/dependency-graph/resolver-factory.ts';
import { ReverseIndexImpl } from './engine/dependency-graph/reverse-index.ts';
import {
  ObjectSchema,
  SchemaWithPipe,
  ArraySchema,
  StringSchema,
  DescriptionAction,
  NumberSchema,
  RecordSchema,
  VariantSchema,
  LiteralSchema,
  GenericSchema,
  OptionalSchema,
  UndefinedSchema,
  VoidSchema,
} from 'valibot';
import {
  ServiceInstance,
  QueryDefinition,
  QueryFunctions,
  CommandDefinition,
  ServiceRegistryApi,
} from '../../types.ts';
import { ModuleGraphStatus, StoriesByFileRecord } from './types.ts';

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
export function registerTestModuleGraphService(workingDir = process.cwd()): ServiceInstance<
  {
    workingDir: string;
    status: ModuleGraphStatus;
    graphRevision: number;
    storiesByFile: StoriesByFileRecord;
    storyChangeRevisions: Record<string, number>;
    latestChangedStoryFiles: string[];
  },
  {
    readonly storiesForFiles: QueryDefinition<
      ModuleGraphServiceState,
      ObjectSchema<
        {
          readonly files: SchemaWithPipe<
            readonly [
              ArraySchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                    >,
                  ]
                >,
                undefined
              >,
              DescriptionAction<
                string[],
                'Source files to look up. Output arrays match this input order.'
              >,
            ]
          >;
        },
        undefined
      >,
      ArraySchema<
        ArraySchema<
          ObjectSchema<
            {
              readonly storyFile: SchemaWithPipe<
                readonly [
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  DescriptionAction<
                    string,
                    'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                  >,
                ]
              >;
              readonly depth: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                  >,
                ]
              >;
            },
            undefined
          >,
          undefined
        >,
        undefined
      >,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "storiesForFiles" has internal: true but must be prefixed with "_"';
          }
      );
    readonly status: QueryDefinition<
      ModuleGraphServiceState,
      UndefinedSchema<undefined>,
      VariantSchema<
        'value',
        [
          ObjectSchema<
            {
              readonly value: LiteralSchema<'booting', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'ready', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'error', undefined>;
              readonly error: SchemaWithPipe<
                readonly [
                  GenericSchema,
                  DescriptionAction<
                    unknown,
                    'Serializable error describing why the module graph failed unexpectedly.'
                  >,
                ]
              >;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'unavailable', undefined>;
              readonly reason: SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                  >,
                ]
              >;
              readonly error: OptionalSchema<
                SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Optional serializable error reported by the builder adapter.'
                    >,
                  ]
                >,
                undefined
              >;
            },
            undefined
          >,
        ],
        undefined
      >,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "status" has internal: true but must be prefixed with "_"';
          }
      );
    readonly graphRevision: QueryDefinition<
      ModuleGraphServiceState,
      OptionalSchema<
        ObjectSchema<
          {
            readonly storyFiles: ArraySchema<
              SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                  >,
                ]
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      NumberSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "graphRevision" has internal: true but must be prefixed with "_"';
          }
      );
    readonly latestStoryChanges: QueryDefinition<
      ModuleGraphServiceState,
      UndefinedSchema<undefined>,
      ObjectSchema<
        {
          readonly revision: SchemaWithPipe<
            readonly [
              NumberSchema<undefined>,
              DescriptionAction<number, 'Graph revision number for this latest story change set.'>,
            ]
          >;
          readonly storyFiles: SchemaWithPipe<
            readonly [
              ArraySchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                    >,
                  ]
                >,
                undefined
              >,
              DescriptionAction<
                string[],
                'Story-index-relative story files touched by the latest module graph change set.'
              >,
            ]
          >;
        },
        undefined
      >,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "latestStoryChanges" has internal: true but must be prefixed with "_"';
          }
      );
    readonly getStatus: QueryDefinition<
      ModuleGraphServiceState,
      UndefinedSchema<undefined>,
      VariantSchema<
        'value',
        [
          ObjectSchema<
            {
              readonly value: LiteralSchema<'booting', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'ready', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'error', undefined>;
              readonly error: SchemaWithPipe<
                readonly [
                  GenericSchema,
                  DescriptionAction<
                    unknown,
                    'Serializable error describing why the module graph failed unexpectedly.'
                  >,
                ]
              >;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'unavailable', undefined>;
              readonly reason: SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                  >,
                ]
              >;
              readonly error: OptionalSchema<
                SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Optional serializable error reported by the builder adapter.'
                    >,
                  ]
                >,
                undefined
              >;
            },
            undefined
          >,
        ],
        undefined
      >,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "getStatus" has internal: true but must be prefixed with "_"';
          }
      );
    readonly getGraphRevision: QueryDefinition<
      ModuleGraphServiceState,
      OptionalSchema<
        ObjectSchema<
          {
            readonly storyFiles: ArraySchema<
              SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                  >,
                ]
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      NumberSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "getGraphRevision" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly storiesForFiles: {
      output: ArraySchema<
        ArraySchema<
          ObjectSchema<
            {
              readonly storyFile: SchemaWithPipe<
                readonly [
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  DescriptionAction<
                    string,
                    'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                  >,
                ]
              >;
              readonly depth: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                  >,
                ]
              >;
            },
            undefined
          >,
          undefined
        >,
        undefined
      >;
    };
    readonly status: {
      output: VariantSchema<
        'value',
        [
          ObjectSchema<
            {
              readonly value: LiteralSchema<'booting', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'ready', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'error', undefined>;
              readonly error: SchemaWithPipe<
                readonly [
                  GenericSchema,
                  DescriptionAction<
                    unknown,
                    'Serializable error describing why the module graph failed unexpectedly.'
                  >,
                ]
              >;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'unavailable', undefined>;
              readonly reason: SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                  >,
                ]
              >;
              readonly error: OptionalSchema<
                SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Optional serializable error reported by the builder adapter.'
                    >,
                  ]
                >,
                undefined
              >;
            },
            undefined
          >,
        ],
        undefined
      >;
    };
    readonly graphRevision: {
      output: NumberSchema<undefined>;
    };
    readonly latestStoryChanges: {
      output: ObjectSchema<
        {
          readonly revision: SchemaWithPipe<
            readonly [
              NumberSchema<undefined>,
              DescriptionAction<number, 'Graph revision number for this latest story change set.'>,
            ]
          >;
          readonly storyFiles: SchemaWithPipe<
            readonly [
              ArraySchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                    >,
                  ]
                >,
                undefined
              >,
              DescriptionAction<
                string[],
                'Story-index-relative story files touched by the latest module graph change set.'
              >,
            ]
          >;
        },
        undefined
      >;
    };
    readonly getStatus: {
      output: VariantSchema<
        'value',
        [
          ObjectSchema<
            {
              readonly value: LiteralSchema<'booting', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'ready', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'error', undefined>;
              readonly error: SchemaWithPipe<
                readonly [
                  GenericSchema,
                  DescriptionAction<
                    unknown,
                    'Serializable error describing why the module graph failed unexpectedly.'
                  >,
                ]
              >;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'unavailable', undefined>;
              readonly reason: SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                  >,
                ]
              >;
              readonly error: OptionalSchema<
                SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Optional serializable error reported by the builder adapter.'
                    >,
                  ]
                >,
                undefined
              >;
            },
            undefined
          >,
        ],
        undefined
      >;
    };
    readonly getGraphRevision: {
      output: NumberSchema<undefined>;
    };
  },
  {
    readonly _applyGraphSnapshot: CommandDefinition<
      ModuleGraphServiceState,
      ObjectSchema<
        {
          readonly storiesByFile: SchemaWithPipe<
            readonly [
              RecordSchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                    >,
                  ]
                >,
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >,
                  undefined
                >,
                undefined
              >,
              DescriptionAction<
                {
                  [x: string]: {
                    [x: string]: number;
                  };
                },
                'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
              >,
            ]
          >;
        },
        undefined
      >,
      VoidSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal: true;
          }
        | {
            __internal_naming_error: 'Operation "_applyGraphSnapshot" is prefixed with "_" and must set internal: true';
          }
      );
    readonly _applyGraphUpdate: CommandDefinition<
      ModuleGraphServiceState,
      ObjectSchema<
        {
          readonly storiesByFile: SchemaWithPipe<
            readonly [
              RecordSchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                    >,
                  ]
                >,
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >,
                  undefined
                >,
                undefined
              >,
              DescriptionAction<
                {
                  [x: string]: {
                    [x: string]: number;
                  };
                },
                'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
              >,
            ]
          >;
          readonly bumpedStoryFiles: SchemaWithPipe<
            readonly [
              ArraySchema<
                SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                    >,
                  ]
                >,
                undefined
              >,
              DescriptionAction<
                string[],
                'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
              >,
            ]
          >;
        },
        undefined
      >,
      VoidSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal: true;
          }
        | {
            __internal_naming_error: 'Operation "_applyGraphUpdate" is prefixed with "_" and must set internal: true';
          }
      );
    readonly _setStatus: CommandDefinition<
      ModuleGraphServiceState,
      VariantSchema<
        'value',
        [
          ObjectSchema<
            {
              readonly value: LiteralSchema<'booting', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'ready', undefined>;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'error', undefined>;
              readonly error: SchemaWithPipe<
                readonly [
                  GenericSchema,
                  DescriptionAction<
                    unknown,
                    'Serializable error describing why the module graph failed unexpectedly.'
                  >,
                ]
              >;
            },
            undefined
          >,
          ObjectSchema<
            {
              readonly value: LiteralSchema<'unavailable', undefined>;
              readonly reason: SchemaWithPipe<
                readonly [
                  StringSchema<undefined>,
                  DescriptionAction<
                    string,
                    'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                  >,
                ]
              >;
              readonly error: OptionalSchema<
                SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Optional serializable error reported by the builder adapter.'
                    >,
                  ]
                >,
                undefined
              >;
            },
            undefined
          >,
        ],
        undefined
      >,
      VoidSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal: true;
          }
        | {
            __internal_naming_error: 'Operation "_setStatus" is prefixed with "_" and must set internal: true';
          }
      );
    readonly _waitForSettledEngine: CommandDefinition<
      ModuleGraphServiceState,
      UndefinedSchema<undefined>,
      VoidSchema<undefined>,
      {
        readonly _applyGraphSnapshot: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _applyGraphUpdate: ObjectSchema<
          {
            readonly storiesByFile: SchemaWithPipe<
              readonly [
                RecordSchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  RecordSchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    SchemaWithPipe<
                      readonly [
                        NumberSchema<undefined>,
                        DescriptionAction<
                          number,
                          'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  undefined
                >,
                DescriptionAction<
                  {
                    [x: string]: {
                      [x: string]: number;
                    };
                  },
                  'Complete relative reverse index keyed by story-index-style source file paths. Values map affected story-index-style story file paths to breadth-first-search depths.'
                >,
              ]
            >;
            readonly bumpedStoryFiles: SchemaWithPipe<
              readonly [
                ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                      >,
                    ]
                  >,
                  undefined
                >,
                DescriptionAction<
                  string[],
                  'Story files whose graph changed, using story-index-style relative paths. Each listed file has its version incremented.'
                >,
              ]
            >;
          },
          undefined
        >;
        readonly _setStatus: VariantSchema<
          'value',
          [
            ObjectSchema<
              {
                readonly value: LiteralSchema<'booting', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'ready', undefined>;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'error', undefined>;
                readonly error: SchemaWithPipe<
                  readonly [
                    GenericSchema,
                    DescriptionAction<
                      unknown,
                      'Serializable error describing why the module graph failed unexpectedly.'
                    >,
                  ]
                >;
              },
              undefined
            >,
            ObjectSchema<
              {
                readonly value: LiteralSchema<'unavailable', undefined>;
                readonly reason: SchemaWithPipe<
                  readonly [
                    StringSchema<undefined>,
                    DescriptionAction<
                      string,
                      'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                    >,
                  ]
                >;
                readonly error: OptionalSchema<
                  SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Optional serializable error reported by the builder adapter.'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
          ],
          undefined
        >;
        readonly _waitForSettledEngine: UndefinedSchema<undefined>;
      },
      {
        readonly _applyGraphSnapshot: VoidSchema<undefined>;
        readonly _applyGraphUpdate: VoidSchema<undefined>;
        readonly _setStatus: VoidSchema<undefined>;
        readonly _waitForSettledEngine: VoidSchema<undefined>;
      },
      QueryFunctions<
        {
          readonly storiesForFiles: ObjectSchema<
            {
              readonly files: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'Input source file path. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Source files to look up. Output arrays match this input order.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly status: UndefinedSchema<undefined>;
          readonly graphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly latestStoryChanges: UndefinedSchema<undefined>;
          readonly getStatus: UndefinedSchema<undefined>;
          readonly getGraphRevision: OptionalSchema<
            ObjectSchema<
              {
                readonly storyFiles: ArraySchema<
                  SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Story file to scope the watch to. Accepts absolute paths, story-index-style relative paths with `./`, or relative paths without `./`. Pass an empty array to watch nothing (returns 0).'
                      >,
                    ]
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        },
        {
          readonly storiesForFiles: ArraySchema<
            ArraySchema<
              ObjectSchema<
                {
                  readonly storyFile: SchemaWithPipe<
                    readonly [
                      SchemaWithPipe<
                        readonly [
                          StringSchema<undefined>,
                          DescriptionAction<
                            string,
                            'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                          >,
                        ]
                      >,
                      DescriptionAction<
                        string,
                        'Affected story file, returned in the same `./`-prefixed relative import-path format used by the story index.'
                      >,
                    ]
                  >;
                  readonly depth: SchemaWithPipe<
                    readonly [
                      NumberSchema<undefined>,
                      DescriptionAction<
                        number,
                        'Breadth-first-search depth: the shortest number of import edges between the source file and this story file.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              undefined
            >,
            undefined
          >;
          readonly status: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly graphRevision: NumberSchema<undefined>;
          readonly latestStoryChanges: ObjectSchema<
            {
              readonly revision: SchemaWithPipe<
                readonly [
                  NumberSchema<undefined>,
                  DescriptionAction<
                    number,
                    'Graph revision number for this latest story change set.'
                  >,
                ]
              >;
              readonly storyFiles: SchemaWithPipe<
                readonly [
                  ArraySchema<
                    SchemaWithPipe<
                      readonly [
                        StringSchema<undefined>,
                        DescriptionAction<
                          string,
                          'A story-index-style relative path such as `./src/Button.stories.tsx`.'
                        >,
                      ]
                    >,
                    undefined
                  >,
                  DescriptionAction<
                    string[],
                    'Story-index-relative story files touched by the latest module graph change set.'
                  >,
                ]
              >;
            },
            undefined
          >;
          readonly getStatus: VariantSchema<
            'value',
            [
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'booting', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'ready', undefined>;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'error', undefined>;
                  readonly error: SchemaWithPipe<
                    readonly [
                      GenericSchema,
                      DescriptionAction<
                        unknown,
                        'Serializable error describing why the module graph failed unexpectedly.'
                      >,
                    ]
                  >;
                },
                undefined
              >,
              ObjectSchema<
                {
                  readonly value: LiteralSchema<'unavailable', undefined>;
                  readonly reason: SchemaWithPipe<
                    readonly [
                      StringSchema<undefined>,
                      DescriptionAction<
                        string,
                        'Human-readable reason why the current builder/runtime cannot provide module graph functionality.'
                      >,
                    ]
                  >;
                  readonly error: OptionalSchema<
                    SchemaWithPipe<
                      readonly [
                        GenericSchema,
                        DescriptionAction<
                          unknown,
                          'Optional serializable error reported by the builder adapter.'
                        >,
                      ]
                    >,
                    undefined
                  >;
                },
                undefined
              >,
            ],
            undefined
          >;
          readonly getGraphRevision: NumberSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal: true;
          }
        | {
            __internal_naming_error: 'Operation "_waitForSettledEngine" is prefixed with "_" and must set internal: true';
          }
      );
  } & {
    readonly _applyGraphSnapshot: {
      output: VoidSchema<undefined>;
    };
    readonly _applyGraphUpdate: {
      output: VoidSchema<undefined>;
    };
    readonly _setStatus: {
      output: VoidSchema<undefined>;
    };
    readonly _waitForSettledEngine: {
      output: VoidSchema<undefined>;
    };
  }
> &
  ServiceRegistryApi {
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
        _waitForSettledEngine: {
          handler: async () => undefined,
        },
      },
    }
  );
}
