import {
  ObjectSchema,
  StringSchema,
  OptionalSchema,
  LooseObjectSchema,
  RecordSchema,
  ArraySchema,
  CustomSchema,
  UndefinedSchema,
  VoidSchema,
} from 'valibot';
import { vs, ys, cs } from '../../../../../dist/chunk-Duv0fAMJ';
import { StrictArgTypes, Args } from '../../../../types/index.ts';
import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { ServiceInstance, ServiceRegistryApi } from '../../types.ts';
import { registerExtractionService } from '../extraction-service.server.ts';
import { docgenServiceDef } from './definition.ts';
import type { DocgenPayload, DocgenProvider } from './types.ts';

export type RegisterDocgenServiceOptions = {
  workingDir?: string;
  /**
   * Returns the current story index when a service needs it. Callers should bind this to a
   * pre-resolved generator so each call does not re-await generator initialization.
   */
  getIndex: () => Promise<StoryIndex>;
  /** Fully composed docgen provider chain from `presets.apply('experimental_docgenProvider', ...)`. */
  docgenProvider: DocgenProvider;
};

/** Registers the `core/docgen` open service against the process-global registry. */
export function registerDocgenService(options: RegisterDocgenServiceOptions): ServiceInstance<
  {
    components: Record<string, DocgenPayload>;
  },
  {
    readonly docgen: vs<
      {
        components: Record<string, DocgenPayload>;
      },
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      OptionalSchema<
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractDocgen: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllDocgen: UndefinedSchema<undefined>;
      },
      {
        readonly extractDocgen: OptionalSchema<
          LooseObjectSchema<
            {
              readonly subcomponents: OptionalSchema<
                RecordSchema<
                  StringSchema<undefined>,
                  LooseObjectSchema<
                    {
                      import: OptionalSchema<StringSchema<undefined>, undefined>;
                      name: StringSchema<undefined>;
                      path: StringSchema<undefined>;
                      description: OptionalSchema<StringSchema<undefined>, undefined>;
                      summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      jsDocTags: RecordSchema<
                        StringSchema<undefined>,
                        ArraySchema<StringSchema<undefined>, undefined>,
                        undefined
                      >;
                      argTypes: OptionalSchema<
                        CustomSchema<StrictArgTypes<Args>, undefined>,
                        undefined
                      >;
                      error: OptionalSchema<
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
                undefined
              >;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly jsDocTags: RecordSchema<
                StringSchema<undefined>,
                ArraySchema<StringSchema<undefined>, undefined>,
                undefined
              >;
              readonly argTypes: OptionalSchema<
                CustomSchema<StrictArgTypes<Args>, undefined>,
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
              readonly id: StringSchema<undefined>;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllDocgen: VoidSchema<undefined>;
      },
      ys<
        {
          readonly docgen: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly docgenForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly docgen: OptionalSchema<
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
              },
              undefined
            >,
            undefined
          >;
          readonly docgenForAllComponents: RecordSchema<
            StringSchema<undefined>,
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
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
            __internal_naming_error: 'Operation "docgen" has internal: true but must be prefixed with "_"';
          }
      );
    readonly docgenForAllComponents: vs<
      {
        components: Record<string, DocgenPayload>;
      },
      VoidSchema<undefined>,
      RecordSchema<
        StringSchema<undefined>,
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractDocgen: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllDocgen: UndefinedSchema<undefined>;
      },
      {
        readonly extractDocgen: OptionalSchema<
          LooseObjectSchema<
            {
              readonly subcomponents: OptionalSchema<
                RecordSchema<
                  StringSchema<undefined>,
                  LooseObjectSchema<
                    {
                      import: OptionalSchema<StringSchema<undefined>, undefined>;
                      name: StringSchema<undefined>;
                      path: StringSchema<undefined>;
                      description: OptionalSchema<StringSchema<undefined>, undefined>;
                      summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      jsDocTags: RecordSchema<
                        StringSchema<undefined>,
                        ArraySchema<StringSchema<undefined>, undefined>,
                        undefined
                      >;
                      argTypes: OptionalSchema<
                        CustomSchema<StrictArgTypes<Args>, undefined>,
                        undefined
                      >;
                      error: OptionalSchema<
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
                undefined
              >;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly jsDocTags: RecordSchema<
                StringSchema<undefined>,
                ArraySchema<StringSchema<undefined>, undefined>,
                undefined
              >;
              readonly argTypes: OptionalSchema<
                CustomSchema<StrictArgTypes<Args>, undefined>,
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
              readonly id: StringSchema<undefined>;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllDocgen: VoidSchema<undefined>;
      },
      ys<
        {
          readonly docgen: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly docgenForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly docgen: OptionalSchema<
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
              },
              undefined
            >,
            undefined
          >;
          readonly docgenForAllComponents: RecordSchema<
            StringSchema<undefined>,
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
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
            __internal_naming_error: 'Operation "docgenForAllComponents" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly docgen: {
      output: OptionalSchema<
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >;
    };
    readonly docgenForAllComponents: {
      output: RecordSchema<
        StringSchema<undefined>,
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >;
    };
  },
  {
    readonly extractDocgen: cs<
      {
        components: Record<string, DocgenPayload>;
      },
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      OptionalSchema<
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >,
      {
        readonly extractDocgen: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllDocgen: UndefinedSchema<undefined>;
      },
      {
        readonly extractDocgen: OptionalSchema<
          LooseObjectSchema<
            {
              readonly subcomponents: OptionalSchema<
                RecordSchema<
                  StringSchema<undefined>,
                  LooseObjectSchema<
                    {
                      import: OptionalSchema<StringSchema<undefined>, undefined>;
                      name: StringSchema<undefined>;
                      path: StringSchema<undefined>;
                      description: OptionalSchema<StringSchema<undefined>, undefined>;
                      summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      jsDocTags: RecordSchema<
                        StringSchema<undefined>,
                        ArraySchema<StringSchema<undefined>, undefined>,
                        undefined
                      >;
                      argTypes: OptionalSchema<
                        CustomSchema<StrictArgTypes<Args>, undefined>,
                        undefined
                      >;
                      error: OptionalSchema<
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
                undefined
              >;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly jsDocTags: RecordSchema<
                StringSchema<undefined>,
                ArraySchema<StringSchema<undefined>, undefined>,
                undefined
              >;
              readonly argTypes: OptionalSchema<
                CustomSchema<StrictArgTypes<Args>, undefined>,
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
              readonly id: StringSchema<undefined>;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllDocgen: VoidSchema<undefined>;
      },
      ys<
        {
          readonly docgen: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly docgenForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly docgen: OptionalSchema<
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
              },
              undefined
            >,
            undefined
          >;
          readonly docgenForAllComponents: RecordSchema<
            StringSchema<undefined>,
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
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
            __internal_naming_error: 'Operation "extractDocgen" has internal: true but must be prefixed with "_"';
          }
      );
    readonly extractAllDocgen: cs<
      {
        components: Record<string, DocgenPayload>;
      },
      UndefinedSchema<undefined>,
      VoidSchema<undefined>,
      {
        readonly extractDocgen: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly extractAllDocgen: UndefinedSchema<undefined>;
      },
      {
        readonly extractDocgen: OptionalSchema<
          LooseObjectSchema<
            {
              readonly subcomponents: OptionalSchema<
                RecordSchema<
                  StringSchema<undefined>,
                  LooseObjectSchema<
                    {
                      import: OptionalSchema<StringSchema<undefined>, undefined>;
                      name: StringSchema<undefined>;
                      path: StringSchema<undefined>;
                      description: OptionalSchema<StringSchema<undefined>, undefined>;
                      summary: OptionalSchema<StringSchema<undefined>, undefined>;
                      jsDocTags: RecordSchema<
                        StringSchema<undefined>,
                        ArraySchema<StringSchema<undefined>, undefined>,
                        undefined
                      >;
                      argTypes: OptionalSchema<
                        CustomSchema<StrictArgTypes<Args>, undefined>,
                        undefined
                      >;
                      error: OptionalSchema<
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
                undefined
              >;
              readonly name: StringSchema<undefined>;
              readonly path: StringSchema<undefined>;
              readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
              readonly jsDocTags: RecordSchema<
                StringSchema<undefined>,
                ArraySchema<StringSchema<undefined>, undefined>,
                undefined
              >;
              readonly argTypes: OptionalSchema<
                CustomSchema<StrictArgTypes<Args>, undefined>,
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
              readonly id: StringSchema<undefined>;
            },
            undefined
          >,
          undefined
        >;
        readonly extractAllDocgen: VoidSchema<undefined>;
      },
      ys<
        {
          readonly docgen: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly docgenForAllComponents: VoidSchema<undefined>;
        },
        {
          readonly docgen: OptionalSchema<
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
              },
              undefined
            >,
            undefined
          >;
          readonly docgenForAllComponents: RecordSchema<
            StringSchema<undefined>,
            LooseObjectSchema<
              {
                readonly subcomponents: OptionalSchema<
                  RecordSchema<
                    StringSchema<undefined>,
                    LooseObjectSchema<
                      {
                        import: OptionalSchema<StringSchema<undefined>, undefined>;
                        name: StringSchema<undefined>;
                        path: StringSchema<undefined>;
                        description: OptionalSchema<StringSchema<undefined>, undefined>;
                        summary: OptionalSchema<StringSchema<undefined>, undefined>;
                        jsDocTags: RecordSchema<
                          StringSchema<undefined>,
                          ArraySchema<StringSchema<undefined>, undefined>,
                          undefined
                        >;
                        argTypes: OptionalSchema<
                          CustomSchema<StrictArgTypes<Args>, undefined>,
                          undefined
                        >;
                        error: OptionalSchema<
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
                  undefined
                >;
                readonly name: StringSchema<undefined>;
                readonly path: StringSchema<undefined>;
                readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
                readonly jsDocTags: RecordSchema<
                  StringSchema<undefined>,
                  ArraySchema<StringSchema<undefined>, undefined>,
                  undefined
                >;
                readonly argTypes: OptionalSchema<
                  CustomSchema<StrictArgTypes<Args>, undefined>,
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
                readonly id: StringSchema<undefined>;
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
            __internal_naming_error: 'Operation "extractAllDocgen" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly extractDocgen: {
      output: OptionalSchema<
        LooseObjectSchema<
          {
            readonly subcomponents: OptionalSchema<
              RecordSchema<
                StringSchema<undefined>,
                LooseObjectSchema<
                  {
                    import: OptionalSchema<StringSchema<undefined>, undefined>;
                    name: StringSchema<undefined>;
                    path: StringSchema<undefined>;
                    description: OptionalSchema<StringSchema<undefined>, undefined>;
                    summary: OptionalSchema<StringSchema<undefined>, undefined>;
                    jsDocTags: RecordSchema<
                      StringSchema<undefined>,
                      ArraySchema<StringSchema<undefined>, undefined>,
                      undefined
                    >;
                    argTypes: OptionalSchema<
                      CustomSchema<StrictArgTypes<Args>, undefined>,
                      undefined
                    >;
                    error: OptionalSchema<
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
              undefined
            >;
            readonly name: StringSchema<undefined>;
            readonly path: StringSchema<undefined>;
            readonly description: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly summary: OptionalSchema<StringSchema<undefined>, undefined>;
            readonly jsDocTags: RecordSchema<
              StringSchema<undefined>,
              ArraySchema<StringSchema<undefined>, undefined>,
              undefined
            >;
            readonly argTypes: OptionalSchema<
              CustomSchema<StrictArgTypes<Args>, undefined>,
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
            readonly id: StringSchema<undefined>;
          },
          undefined
        >,
        undefined
      >;
    };
    readonly extractAllDocgen: {
      output: VoidSchema<undefined>;
    };
  }
> &
  ServiceRegistryApi {
  return registerExtractionService(docgenServiceDef, {
    workingDir: options.workingDir ?? process.cwd(),
    getIndex: options.getIndex,
    provider: options.docgenProvider,
    queryName: 'docgen',
    extractCommand: 'extractDocgen',
    extractAllCommand: 'extractAllDocgen',
  });
}
