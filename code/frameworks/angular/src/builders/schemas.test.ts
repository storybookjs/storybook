import { schema } from '@angular-devkit/core';
import { assert, describe, expect, it } from 'vitest';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';

const schemas = [
  ['build-schema.json', buildSchema],
  ['start-schema.json', startSchema],
] as const;

describe.each(schemas)('%s', (_file, builderSchema) => {
  const validateLoglevel = async (loglevel: string) => {
    assert(schema.isJsonSchema(builderSchema));
    const validate = await new schema.CoreSchemaRegistry().compile(builderSchema);
    return validate({ loglevel });
  };

  it.each(['trace', 'debug', 'info', 'warn', 'error', 'silent'])(
    'accepts loglevel "%s"',
    async (loglevel) => {
      await expect(validateLoglevel(loglevel)).resolves.toMatchObject({ success: true });
    }
  );

  it.each(['xerror', 'warning', 'errors', '', 'ERROR'])(
    'rejects loglevel "%s"',
    async (loglevel) => {
      await expect(validateLoglevel(loglevel)).resolves.toMatchObject({
        success: false,
        errors: [{ instancePath: '/loglevel' }],
      });
    }
  );
});
