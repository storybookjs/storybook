import type { Args } from 'storybook/internal/types';
import {
  createDynamicSnippetInput,
  dynamicSnippetInputKey,
  type DynamicSnippetRecord,
  type DynamicSnippetSlot,
  type QueryState,
} from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

import { useQuerySubscription } from './use-query-subscription.ts';

const selectRecord = (record: DynamicSnippetRecord | undefined) => record;

export function useDynamicSnippet(
  storyId: string,
  args: Args = {},
  slot: DynamicSnippetSlot = 'current'
): QueryState<DynamicSnippetRecord | undefined> {
  const service = getService('core/dynamic-snippets', { internal: true });
  const input = createDynamicSnippetInput(storyId, args, slot);
  return useQuerySubscription(
    dynamicSnippetInputKey(input),
    service.queries.dynamicSnippet,
    input,
    selectRecord
  );
}
