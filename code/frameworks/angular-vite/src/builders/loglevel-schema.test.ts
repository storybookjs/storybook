import { describe, expect, it } from 'vitest';

import buildSchema from './build-storybook/schema.json';
import startSchema from './start-storybook/schema.json';

describe('Angular builder loglevel schema', () => {
  it('accepts the documented error loglevel', () => {
    const buildPattern = new RegExp(buildSchema.properties.loglevel.pattern);
    const startPattern = new RegExp(startSchema.properties.loglevel.pattern);

    expect(buildPattern.test('error')).toBe(true);
    expect(startPattern.test('error')).toBe(true);
  });
});
