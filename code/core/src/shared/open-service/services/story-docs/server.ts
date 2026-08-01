import {
  ObjectSchema,
  StringSchema,
  OptionalSchema,
  RecordSchema,
  UndefinedSchema,
  VoidSchema,
} from 'valibot';
import { vs, ys, cs } from '../../../../../dist/chunk-Duv0fAMJ';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { ServiceInstance, ServiceRegistryApi } from '../../types.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { storyDocsServiceDef, StoryDocsServiceState } from './definition.ts';
import type { StoryDocsProvider } from './types.ts';

export type RegisterStoryDocsServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /**
   * Fully composed story-docs provider chain from
   * `presets.apply('experimental_storyDocsProvider', ...)`.
   */
  storyDocsProvider: StoryDocsProvider;
};

/** Registers the `core/story-docs` open service against the process-global registry. */
export function registerStoryDocsService(options: RegisterStoryDocsServiceOptions): ServiceInstance<
  StoryDocsServiceState,
  {
    readonly storyDocs: vs<
      StoryDocsServiceState,
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      OptionalSchema<
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractStoryDocs: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllStoryDocs: UndefinedSchema<undefined>;
      },
      {
        readonly extractStoryDocs: OptionalSchema<
          ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly stories: RecordSchema<
                StringSchema<undefined>,
                ObjectSchema<
                  {
                    readonly id: StringSchema<undefined>;
                    readonly name: StringSchema<undefined>;
                    readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly error: OptionalSchema<
                      ObjectSchema<
                        {
                          readonly name: StringSchema<undefined>;
                          readonly message: StringSchema<undefined>;
                        },
                        undefined
                      >,
                      undefined
                    >;
                  },
                  undefined
                >,
                undefined
              >;
              readonly error: OptionalSchema<
                ObjectSchema<
                  {
                    readonly name: StringSchema<undefined>;
                    readonly message: StringSchema<undefined>;
                  },
                  undefined
                >,
                undefined
              >;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllStoryDocs: VoidSchema<undefined>;
      },
      ys<
        {
          readonly storyDocs: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly storyDocsForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly storyDocs: OptionalSchema<
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly storyDocsForAllComponents: RecordSchema<
            StringSchema<undefined>,
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "storyDocs" has internal: true but must be prefixed with "_"';
          }
      );
    readonly storyDocsForAllComponents: vs<
      StoryDocsServiceState,
      VoidSchema<undefined>,
      RecordSchema<
        StringSchema<undefined>,
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractStoryDocs: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllStoryDocs: UndefinedSchema<undefined>;
      },
      {
        readonly extractStoryDocs: OptionalSchema<
          ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly stories: RecordSchema<
                StringSchema<undefined>,
                ObjectSchema<
                  {
                    readonly id: StringSchema<undefined>;
                    readonly name: StringSchema<undefined>;
                    readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly error: OptionalSchema<
                      ObjectSchema<
                        {
                          readonly name: StringSchema<undefined>;
                          readonly message: StringSchema<undefined>;
                        },
                        undefined
                      >,
                      undefined
                    >;
                  },
                  undefined
                >,
                undefined
              >;
              readonly error: OptionalSchema<
                ObjectSchema<
                  {
                    readonly name: StringSchema<undefined>;
                    readonly message: StringSchema<undefined>;
                  },
                  undefined
                >,
                undefined
              >;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllStoryDocs: VoidSchema<undefined>;
      },
      ys<
        {
          readonly storyDocs: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly storyDocsForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly storyDocs: OptionalSchema<
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly storyDocsForAllComponents: RecordSchema<
            StringSchema<undefined>,
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "storyDocsForAllComponents" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly storyDocs: {
      output: OptionalSchema<
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >;
    };
    readonly storyDocsForAllComponents: {
      output: RecordSchema<
        StringSchema<undefined>,
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >;
    };
  },
  {
    readonly extractStoryDocs: cs<
      StoryDocsServiceState,
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      OptionalSchema<
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractStoryDocs: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllStoryDocs: UndefinedSchema<undefined>;
      },
      {
        readonly extractStoryDocs: OptionalSchema<
          ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly stories: RecordSchema<
                StringSchema<undefined>,
                ObjectSchema<
                  {
                    readonly id: StringSchema<undefined>;
                    readonly name: StringSchema<undefined>;
                    readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly error: OptionalSchema<
                      ObjectSchema<
                        {
                          readonly name: StringSchema<undefined>;
                          readonly message: StringSchema<undefined>;
                        },
                        undefined
                      >,
                      undefined
                    >;
                  },
                  undefined
                >,
                undefined
              >;
              readonly error: OptionalSchema<
                ObjectSchema<
                  {
                    readonly name: StringSchema<undefined>;
                    readonly message: StringSchema<undefined>;
                  },
                  undefined
                >,
                undefined
              >;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllStoryDocs: VoidSchema<undefined>;
      },
      ys<
        {
          readonly storyDocs: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly storyDocsForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly storyDocs: OptionalSchema<
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly storyDocsForAllComponents: RecordSchema<
            StringSchema<undefined>,
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "extractStoryDocs" has internal: true but must be prefixed with "_"';
          }
      );
    readonly extractAllStoryDocs: cs<
      StoryDocsServiceState,
      UndefinedSchema<undefined>,
      VoidSchema<undefined>,
      {
        readonly extractStoryDocs: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllStoryDocs: UndefinedSchema<undefined>;
      },
      {
        readonly extractStoryDocs: OptionalSchema<
          ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly stories: RecordSchema<
                StringSchema<undefined>,
                ObjectSchema<
                  {
                    readonly id: StringSchema<undefined>;
                    readonly name: StringSchema<undefined>;
                    readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    readonly error: OptionalSchema<
                      ObjectSchema<
                        {
                          readonly name: StringSchema<undefined>;
                          readonly message: StringSchema<undefined>;
                        },
                        undefined
                      >,
                      undefined
                    >;
                  },
                  undefined
                >,
                undefined
              >;
              readonly error: OptionalSchema<
                ObjectSchema<
                  {
                    readonly name: StringSchema<undefined>;
                    readonly message: StringSchema<undefined>;
                  },
                  undefined
                >,
                undefined
              >;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllStoryDocs: VoidSchema<undefined>;
      },
      ys<
        {
          readonly storyDocs: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly storyDocsForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly storyDocs: OptionalSchema<
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
          readonly storyDocsForAllComponents: RecordSchema<
            StringSchema<undefined>,
            ObjectSchema<
              {
                readonly id: StringSchema<undefined>;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly stories: RecordSchema<
                  StringSchema<undefined>,
                  ObjectSchema<
                    {
                      readonly id: StringSchema<undefined>;
                      readonly name: StringSchema<undefined>;
                      readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      readonly error: OptionalSchema<
                        ObjectSchema<
                          {
                            readonly name: StringSchema<undefined>;
                            readonly message: StringSchema<undefined>;
                          },
                          undefined
                        >,
                        undefined
                      >;
                    },
                    undefined
                  >,
                  undefined
                >;
                readonly error: OptionalSchema<
                  ObjectSchema<
                    {
                      readonly name: StringSchema<undefined>;
                      readonly message: StringSchema<undefined>;
                    },
                    undefined
                  >,
                  undefined
                >;
              },
              undefined
            >,
            undefined
          >;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "extractAllStoryDocs" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly extractStoryDocs: {
      output: OptionalSchema<
        ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly import: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly stories: RecordSchema<
              StringSchema<undefined>,
              ObjectSchema<
                {
                  readonly id: StringSchema<undefined>;
                  readonly name: StringSchema<undefined>;
                  readonly snippet: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                  readonly error: OptionalSchema<
                    ObjectSchema<
                      {
                        readonly name: StringSchema<undefined>;
                        readonly message: StringSchema<undefined>;
                      },
                      undefined
                    >,
                    undefined
                  >;
                },
                undefined
              >,
              undefined
            >;
            readonly error: OptionalSchema<
              ObjectSchema<
                {
                  readonly name: StringSchema<undefined>;
                  readonly message: StringSchema<undefined>;
                },
                undefined
              >,
              undefined
            >;
          },
          undefined
        >,
        undefined
      >;
    };
    readonly extractAllStoryDocs: {
      output: VoidSchema<undefined>;
    };
  }
> &
  ServiceRegistryApi {
  return registerExtractionService(storyDocsServiceDef, {
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: options.storyDocsProvider,
    queryName: 'storyDocs',
    extractCommand: 'extractStoryDocs',
    extractAllCommand: 'extractAllStoryDocs',
  });
}
