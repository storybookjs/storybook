import { schema } from '@angular-devkit/core';
import { assert, describe, expect, it } from 'vitest';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';

type SchemaProperty = { type?: string | string[] };
type Schema = { properties: Record<string, SchemaProperty> };

function optionsAcceptingStringAndBoolean(builderSchema: Schema): Array<[string, SchemaProperty]> {
  return Object.entries(builderSchema.properties).filter(
    ([, property]) =>
      Array.isArray(property.type) &&
      property.type.includes('string') &&
      property.type.includes('boolean')
  );
}

const schemas = [
  ['build-schema.json', buildSchema],
  ['start-schema.json', startSchema],
] as const;

describe.each(schemas)('%s', (_file, builderSchema) => {
  // The Angular CLI registers each builder option with yargs using only the first entry of
  // `type`, so a boolean-first `statsJson` turns `--stats-json=<path>` into `false`.
  it('lists string before boolean for every option that accepts both', () => {
    const options = optionsAcceptingStringAndBoolean(builderSchema);

    expect(options.map(([name, property]) => [name, property.type])).toEqual([
      ['statsJson', ['string', 'boolean']],
    ]);
  });

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
