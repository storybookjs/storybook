import { describe, expect, it } from 'vitest';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';

type SchemaProperty = { type?: string | string[] };
type Schema = { properties: Record<string, SchemaProperty> };

function optionsAcceptingStringAndBoolean(schema: Schema): Array<[string, SchemaProperty]> {
  return Object.entries(schema.properties).filter(
    ([, property]) =>
      Array.isArray(property.type) &&
      property.type.includes('string') &&
      property.type.includes('boolean')
  );
}

const schemas: Array<[file: string, schema: Schema]> = [
  ['build-schema.json', buildSchema],
  ['start-schema.json', startSchema],
];

// The Angular CLI registers each builder option with yargs using only the first entry of
// `type`, so a boolean-first `statsJson` turns `--stats-json=<path>` into `false`.
describe.each(schemas)('%s', (_file: string, schema: Schema) => {
  it('lists string before boolean for every option that accepts both', () => {
    const options = optionsAcceptingStringAndBoolean(schema);

    expect(options.map(([name, property]) => [name, property.type])).toEqual([
      ['statsJson', ['string', 'boolean']],
    ]);
  });
});
