import { describe, expect, it } from 'vitest';
import * as v from 'valibot';

import { assertObjectCompatibleOutputSchema } from './toolset-definition.ts';

describe('assertObjectCompatibleOutputSchema', () => {
  it('accepts an object schema', () => {
    expect(() =>
      assertObjectCompatibleOutputSchema(v.object({ title: v.string() }), 'stories.preview')
    ).not.toThrow();
  });

  it('rejects a literal scalar that probe sampling would miss', () => {
    expect(() => assertObjectCompatibleOutputSchema(v.literal(2), 'stories.preview')).toThrow(
      /must describe a JSON object/
    );
  });

  it('rejects an optional object because undefined is not structuredContent', () => {
    expect(() =>
      assertObjectCompatibleOutputSchema(v.optional(v.object({ title: v.string() })), 'docs.show')
    ).toThrow(/accepts undefined/);
  });
});
