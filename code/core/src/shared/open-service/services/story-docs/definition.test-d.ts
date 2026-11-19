import type * as v from 'valibot';
import { expectTypeOf, it } from 'vitest';

import type { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsPayload } from './types.ts';

type StoryDocsOutput = v.InferOutput<typeof storyDocsServiceDef.queries.storyDocs.output>;

it('parses the story-docs payload with a schema that has every field of its type', () => {
  expectTypeOf<StoryDocsOutput>().toEqualTypeOf<StoryDocsPayload | undefined>();
});
