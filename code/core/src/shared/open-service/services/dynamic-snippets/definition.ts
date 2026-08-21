import * as v from 'valibot';

import { defineService } from 'storybook/open-service';
import type { StoryDocsService } from '../story-docs/definition.ts';
import {
  type DynamicSnippetState,
  dynamicSnippetRevision,
  selectDynamicSnippetRecord,
} from './dynamic-snippet.ts';

const dynamicSnippetInputFields = {
  storyId: v.string(),
  argsKey: v.string(),
  slot: v.picklist(['current', 'initial']),
};

const dynamicSnippetInputSchema = v.object(dynamicSnippetInputFields);
const dynamicSnippetRenderInputSchema = v.object({
  ...dynamicSnippetInputFields,
  renderId: v.optional(v.string()),
});

const dynamicSnippetRecordSchema = v.object({
  revision: v.string(),
  source: v.optional(v.string()),
  transformedSource: v.optional(v.string()),
  warning: v.optional(v.string()),
});

const dynamicSnippetOutputSchema = v.optional(dynamicSnippetRecordSchema);

export type DynamicSnippetServiceState = {
  records: DynamicSnippetState;
};

export const dynamicSnippetServiceDef = defineService({
  id: 'core/dynamic-snippets',
  internal: true,
  description: 'Browser-rendered story source keyed by story and args.',
  initialState: { records: {} } as DynamicSnippetServiceState,
  queries: {
    dynamicSnippet: {
      description: 'Returns the rendered source for one story and args value.',
      input: dynamicSnippetInputSchema,
      output: dynamicSnippetOutputSchema,
      handler: (input, ctx) => selectDynamicSnippetRecord(ctx.self.state.records, input),
      load: async (input, ctx) => {
        const componentId = input.storyId.split('--')[0]!;
        const storyDocs = ctx.getService<StoryDocsService>('core/story-docs', { internal: true });
        const current = selectDynamicSnippetRecord(ctx.self.state.records, input);
        let payload = storyDocs.queries.storyDocs.get({ id: componentId });

        if (payload === undefined || payload.error) {
          try {
            payload = await storyDocs.queries.storyDocs.loaded({ id: componentId });
          } catch {
            payload = storyDocs.queries.storyDocs.get({ id: componentId });
          }
          if (current && (payload === undefined || payload.error)) {
            return;
          }
        }

        if (current && current.revision === dynamicSnippetRevision(payload, input.storyId)) {
          return;
        }

        await ctx.self.commands.renderDynamicSnippet(input);
      },
    },
  },
  commands: {
    renderDynamicSnippet: {
      description: 'Renders and stores source for one story and args value in the preview.',
      input: dynamicSnippetRenderInputSchema,
      output: dynamicSnippetOutputSchema,
    },
  },
});
