import { registerService } from 'storybook/internal/common';

import { staticLoadSyncServiceDef, type StaticLoadDemoState } from './definition.ts';
import {
  ObjectSchema,
  StringSchema,
  OptionalSchema,
  UndefinedSchema,
  VoidSchema,
  NullableSchema,
} from 'valibot';
import { ks, vs, ys, cs, Ms } from '../../../../../dist/chunk-Duv0fAMJ';

export function registerStaticLoadSyncService(): ks<
  StaticLoadDemoState,
  {
    readonly entry: vs<
      StaticLoadDemoState,
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      OptionalSchema<StringSchema<undefined>, undefined>,
      {
        readonly computeEntry: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly computeUnbacked: UndefinedSchema<undefined>;
      },
      {
        readonly computeEntry: VoidSchema<undefined>;
        readonly computeUnbacked: VoidSchema<undefined>;
      },
      ys<
        {
          readonly entry: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly unbacked: VoidSchema<undefined>;
        },
        {
          readonly entry: OptionalSchema<StringSchema<undefined>, undefined>;
          readonly unbacked: NullableSchema<StringSchema<undefined>, undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "entry" has internal: true but must be prefixed with "_"';
          }
      );
    readonly unbacked: vs<
      StaticLoadDemoState,
      VoidSchema<undefined>,
      NullableSchema<StringSchema<undefined>, undefined>,
      {
        readonly computeEntry: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly computeUnbacked: UndefinedSchema<undefined>;
      },
      {
        readonly computeEntry: VoidSchema<undefined>;
        readonly computeUnbacked: VoidSchema<undefined>;
      },
      ys<
        {
          readonly entry: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly unbacked: VoidSchema<undefined>;
        },
        {
          readonly entry: OptionalSchema<StringSchema<undefined>, undefined>;
          readonly unbacked: NullableSchema<StringSchema<undefined>, undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "unbacked" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly entry: {
      output: OptionalSchema<StringSchema<undefined>, undefined>;
    };
    readonly unbacked: {
      output: NullableSchema<StringSchema<undefined>, undefined>;
    };
  },
  {
    readonly computeEntry: cs<
      StaticLoadDemoState,
      ObjectSchema<
        {
          readonly id: StringSchema<undefined>;
        },
        undefined
      >,
      VoidSchema<undefined>,
      {
        readonly computeEntry: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly computeUnbacked: UndefinedSchema<undefined>;
      },
      {
        readonly computeEntry: VoidSchema<undefined>;
        readonly computeUnbacked: VoidSchema<undefined>;
      },
      ys<
        {
          readonly entry: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly unbacked: VoidSchema<undefined>;
        },
        {
          readonly entry: OptionalSchema<StringSchema<undefined>, undefined>;
          readonly unbacked: NullableSchema<StringSchema<undefined>, undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "computeEntry" has internal: true but must be prefixed with "_"';
          }
      );
    readonly computeUnbacked: cs<
      StaticLoadDemoState,
      UndefinedSchema<undefined>,
      VoidSchema<undefined>,
      {
        readonly computeEntry: ObjectSchema<
          {
            readonly id: StringSchema<undefined>;
          },
          undefined
        >;
        readonly computeUnbacked: UndefinedSchema<undefined>;
      },
      {
        readonly computeEntry: VoidSchema<undefined>;
        readonly computeUnbacked: VoidSchema<undefined>;
      },
      ys<
        {
          readonly entry: ObjectSchema<
            {
              readonly id: StringSchema<undefined>;
            },
            undefined
          >;
          readonly unbacked: VoidSchema<undefined>;
        },
        {
          readonly entry: OptionalSchema<StringSchema<undefined>, undefined>;
          readonly unbacked: NullableSchema<StringSchema<undefined>, undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "computeUnbacked" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly computeEntry: {
      output: VoidSchema<undefined>;
    };
    readonly computeUnbacked: {
      output: VoidSchema<undefined>;
    };
  }
> &
  Ms {
  return registerService(staticLoadSyncServiceDef, {
    commands: {
      computeEntry: {
        handler: async (input, ctx) => {
          ctx.self.setState((state: StaticLoadDemoState) => {
            state.entries[input.id] = `static-load:${input.id}`;
          });
        },
      },
      computeUnbacked: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state: StaticLoadDemoState) => {
            state.unbacked = 'static-load:unbacked';
          });
        },
      },
    },
  });
}
