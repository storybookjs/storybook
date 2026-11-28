import type * as v from 'valibot';
import { expectTypeOf, it } from 'vitest';

import type { docgenServiceDef } from './definition.ts';
import type { ComponentSummary } from './types.ts';

type Summaries = v.InferOutput<typeof docgenServiceDef.commands.summarizeComponents.output>;

it('parses a component summary with a schema that has every field of its type', () => {
  expectTypeOf<Summaries>().toEqualTypeOf<ComponentSummary[]>();
});
