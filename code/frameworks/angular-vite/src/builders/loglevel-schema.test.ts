import { describe, expect, it } from 'vitest';

import buildSchema from './build-storybook/schema.json';
import startSchema from './start-storybook/schema.json';

describe('Angular builder loglevel schema', () => {
  it('accepts documented loglevels and rejects invalid values', () => {
    const buildPattern = new RegExp(buildSchema.properties.loglevel.pattern);
    const startPattern = new RegExp(startSchema.properties.loglevel.pattern);

    const valid = ['silly', 'verbose', 'info', 'warn', 'error', 'silent'];
    const invalid = ['xerror', 'warning', 'errors', '', 'ERROR'];

    valid.forEach((level) => {
      expect(buildPattern.test(level)).toBe(true);
      expect(startPattern.test(level)).toBe(true);
    });

    invalid.forEach((level) => {
      expect(buildPattern.test(level)).toBe(false);
      expect(startPattern.test(level)).toBe(false);
    });
  });
});
