import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Presets } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { moduleGraphServiceDef } from './definition.ts';
import type { ChangeDetectionAdapter } from './engine/adapters/types.ts';
import { ModuleGraphEngine, type ModuleGraphEngineOptions } from './engine/module-graph-engine.ts';
import {
  errorToErrorLike,
  ModuleGraphServiceState,
  ModuleGraphStatus,
  StoriesByFileRecord,
} from './types.ts';
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

export type RegisterModuleGraphServiceOptions = {
  channel: ChannelLike;
  getIndex: ModuleGraphEngineOptions['getIndex'];
  workingDir?: string;
  presets?: Presets;
};

/**
 * Deferred builder adapter. Open-service registration runs early in the dev-server boot, but the
 * preview builder that produces the {@link ChangeDetectionAdapter} is only ready later. The
 * dev-server resolves this once the adapter exists; the engine awaits it before building the graph.
 *
 * `resolveChangeDetectionAdapter` is exported directly (rather than wrapped in a helper) so the
 * dev-server can resolve the promise with one import.
 */
let resolveAdapter!: (adapter: ChangeDetectionAdapter | null | undefined) => void;

export const changeDetectionAdapterPromise = new Promise<ChangeDetectionAdapter | null | undefined>(
  (resolve) => {
    resolveAdapter = resolve;
  }
);

export function resolveChangeDetectionAdapter(
  adapter: ChangeDetectionAdapter | null | undefined
): void {
  resolveAdapter(adapter);
}

/**
 * Registers the `core/module-graph` open service, constructs the graph engine, wires state mirroring
 * into the service commands, and listens for story-index invalidation on the server channel. The
 * engine starts once {@link resolveChangeDetectionAdapter} provides the builder adapter.
 *
 * The engine lives for the entire dev-server process, so there is no teardown path: the OS reclaims
 * everything when the process exits.
 */
export function registerModuleGraphService(
  options: RegisterModuleGraphServiceOptions
): ServiceInstance<
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
  const workingDir = options.workingDir ?? process.cwd();
  let engine: ModuleGraphEngine | undefined = undefined;

  const runtime = registerService(
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
          handler: async () => {
            await engine!.whenSettled();
          },
        },
      },
    }
  );

  engine = new ModuleGraphEngine({
    getIndex: options.getIndex,
    workingDir,
    presets: options.presets,
    onSnapshot: (storiesByFile) => {
      void runtime.commands._applyGraphSnapshot({ storiesByFile });
    },
    onUpdate: ({ storiesByFile, bumpedStoryFiles }) => {
      void runtime.commands._applyGraphUpdate({ storiesByFile, bumpedStoryFiles });
    },
    onError: (error) => {
      void runtime.commands._setStatus({ value: 'error', error: errorToErrorLike(error) });
    },
    onUnavailable: (reason, error) => {
      void runtime.commands._setStatus({
        value: 'unavailable',
        reason,
        ...(error ? { error: errorToErrorLike(error) } : {}),
      });
    },
  });

  options.channel.on(STORY_INDEX_INVALIDATED, () => {
    engine!.onStoryIndexInvalidated();
  });

  void changeDetectionAdapterPromise.then((adapter) => {
    if (!adapter) {
      void runtime.commands._setStatus({
        value: 'unavailable',
        reason: 'builder does not support change detection',
      });
      return;
    }
    engine!.start(adapter);
  });

  return runtime;
}
