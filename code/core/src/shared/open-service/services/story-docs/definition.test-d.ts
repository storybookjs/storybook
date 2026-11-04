import type * as v from 'valibot';
import { expectTypeOf, it } from 'vitest';

import type { storyDocsServiceDef } from './definition.ts';
import type { StoryDocsPayload, StoryTemplatesPayload } from './types.ts';

type StoryDocsOutput = v.InferOutput<typeof storyDocsServiceDef.queries.storyDocs.output>;

it('parses the story-docs payload with a schema that has every field of its type', () => {
  expectTypeOf<StoryDocsOutput>().toEqualTypeOf<StoryDocsPayload | undefined>();
});

type StoryTemplatesOutput = v.InferOutput<typeof storyDocsServiceDef.queries.storyTemplates.output>;

it('parses the story templates with a schema that has every field of their type', () => {
  expectTypeOf<StoryTemplatesOutput>().toEqualTypeOf<StoryTemplatesPayload | undefined>();
});
