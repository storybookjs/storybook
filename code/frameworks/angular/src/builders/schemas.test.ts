import { describe, expect, it } from 'vitest';

import buildSchema from '../../build-schema.json';
import startSchema from '../../start-schema.json';

const schemas = [
  ['build-schema.json', buildSchema],
  ['start-schema.json', startSchema],
] as const;

describe.each(schemas)('%s', (_file, schema) => {
  it('accepts supported log levels and rejects partial matches', () => {
    const pattern = new RegExp(schema.properties.loglevel.pattern);

    ['trace', 'debug', 'info', 'warn', 'error', 'silent'].forEach((level) => {
      expect(pattern.test(level)).toBe(true);
    });

    ['xerror', 'warning', 'errors', '', 'ERROR'].forEach((level) => {
      expect(pattern.test(level)).toBe(false);
    });
  });
});
