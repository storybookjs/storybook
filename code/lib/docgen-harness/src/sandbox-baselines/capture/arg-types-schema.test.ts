import { expect, it } from 'vitest';

import { argTypesSchema } from './arg-types-schema.ts';
import { collectCurrentOrBetterViolations } from '../../compare/expect-current-or-better.ts';

it('preserves legacy free-form type text in a canonical other node', () => {
  const baseline = argTypesSchema.parse({
    direction: { name: 'direction', type: { name: '"up" | "down"', required: true } },
  });
  expect(baseline.direction.type).toEqual({
    name: 'other',
    value: '"up" | "down"',
    required: true,
  });
  expect(argTypesSchema.parse({ unknown: { name: 'unknown', type: {} } }).unknown.type).toEqual({
    name: 'other',
    value: 'undefined',
  });
  const candidate = {
    direction: {
      name: 'direction',
      type: { name: 'enum' as const, value: ['up', 'down', 'neutral'] },
    },
  };
  expect(
    collectCurrentOrBetterViolations({
      kind: 'argTypes',
      baseline,
      candidate,
      legacyBaseline: true,
    })
  ).toEqual([]);
  expect(() =>
    argTypesSchema.parse({ broken: { name: 'broken', type: { name: 'enum' } } })
  ).toThrow();
});
