import { registerService } from 'storybook/internal/common';
import { localCommandSyncServiceDef } from './definition.ts';
import { VoidSchema, StringSchema, ObjectSchema } from 'valibot';
import { ks, vs, ys, cs, Ms } from '../../../../../dist/chunk-Duv0fAMJ';

export function registerLocalCommandSyncService(): ks<
  {
    value: string;
  },
  {
    readonly value: vs<
      {
        value: string;
      },
      VoidSchema<undefined>,
      StringSchema<undefined>,
      {
        readonly setValue: ObjectSchema<
          {
            readonly value: StringSchema<undefined>;
          },
          undefined
        >;
      },
      {
        readonly setValue: VoidSchema<undefined>;
      },
      ys<
        {
          readonly value: VoidSchema<undefined>;
        },
        {
          readonly value: StringSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "value" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly value: {
      output: StringSchema<undefined>;
    };
  },
  {
    readonly setValue: cs<
      {
        value: string;
      },
      ObjectSchema<
        {
          readonly value: StringSchema<undefined>;
        },
        undefined
      >,
      VoidSchema<undefined>,
      {
        readonly setValue: ObjectSchema<
          {
            readonly value: StringSchema<undefined>;
          },
          undefined
        >;
      },
      {
        readonly setValue: VoidSchema<undefined>;
      },
      ys<
        {
          readonly value: VoidSchema<undefined>;
        },
        {
          readonly value: StringSchema<undefined>;
        }
      >
    > &
      (
        | {
            internal?: false;
          }
        | {
            __internal_naming_error: 'Operation "setValue" has internal: true but must be prefixed with "_"';
          }
      );
  } & {
    readonly setValue: {
      output: VoidSchema<undefined>;
    };
  }
> &
  Ms {
  const service = registerService(localCommandSyncServiceDef);

  let previousValue: string | undefined;

  service.queries.value.subscribe(undefined, ({ data }) => {
    const value = data ?? '';
    if (previousValue === undefined) {
      console.log(`[open-service-local-command-sync-demo] initial value: ${JSON.stringify(value)}`);
    } else if (value !== previousValue) {
      console.log(
        `[open-service-local-command-sync-demo] value changed: ${JSON.stringify(previousValue)} -> ${JSON.stringify(value)}`
      );
    }
    previousValue = value;
  });

  return service;
}
