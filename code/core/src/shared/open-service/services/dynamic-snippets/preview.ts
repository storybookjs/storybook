import { once } from 'storybook/internal/client-logger';
import { definePreviewAddon } from 'storybook/internal/csf';
import { isStoryDocsSnippetEligible } from 'storybook/internal/docs-tools';
import type { CleanupCallback, StoryContext } from 'storybook/internal/types';

import { nanoid } from 'nanoid';

import { getService, registerService } from '../../preview.ts';
import type { StoryDocsService } from '../story-docs/definition.ts';
import { selectWarningForStory } from '../story-docs/snippet.ts';
import type { StoryDocsPayload } from '../story-docs/types.ts';
import { dynamicSnippetServiceDef } from './definition.ts';
import {
  createDynamicSnippetInput,
  type DynamicSnippetSlot,
  dynamicSnippetRevision,
  renderDynamicSnippetSource,
  selectDynamicSnippetRecord,
} from './dynamic-snippet.ts';

type ActiveStoryContext = {
  argsKey: string;
  renderId: string;
  context: StoryContext;
};

type StorySlots<T> = Partial<Record<DynamicSnippetSlot, T>>;

type ActiveRequest = {
  renderId?: string;
};

type DynamicSnippetRuntime = {
  contexts: Map<string, StorySlots<ActiveStoryContext>>;
  requests: Map<string, StorySlots<ActiveRequest>>;
};

type SourceTransform = (source: string, context: StoryContext) => string | Promise<string>;

// Preview service registration survives HMR, so its original command handler and the newest
// beforeEach hook need one realm-wide store for transient, non-serializable story contexts.
const DYNAMIC_SNIPPET_RUNTIME = Symbol.for('storybook.open-service.dynamic-snippet-runtime');

function getDynamicSnippetRuntime(): DynamicSnippetRuntime {
  const runtime = globalThis as typeof globalThis & {
    [key: symbol]: DynamicSnippetRuntime | undefined;
  };
  return (runtime[DYNAMIC_SNIPPET_RUNTIME] ??= {
    contexts: new Map(),
    requests: new Map(),
  });
}

export const registerDynamicSnippetPreviewService = () =>
  registerService(dynamicSnippetServiceDef, {
    commands: {
      renderDynamicSnippet: {
        handler: async (input, ctx) => {
          const runtime = getDynamicSnippetRuntime();
          const alternateSlot = input.slot === 'current' ? 'initial' : 'current';
          const storyContexts = runtime.contexts.get(input.storyId);
          const activeContext = [storyContexts?.[input.slot], storyContexts?.[alternateSlot]].find(
            (candidate) =>
              candidate?.argsKey === input.argsKey &&
              (input.renderId === undefined || candidate.renderId === input.renderId)
          );

          if (input.renderId !== undefined && activeContext === undefined) {
            return undefined;
          }

          const request: ActiveRequest = { renderId: activeContext?.renderId };
          const storyRequests = runtime.requests.get(input.storyId) ?? {};
          storyRequests[input.slot] = request;
          runtime.requests.set(input.storyId, storyRequests);

          try {
            const componentId = input.storyId.split('--')[0]!;
            const storyDocs = ctx.getService<StoryDocsService>('core/story-docs', {
              internal: true,
            });
            let payload: StoryDocsPayload | undefined = storyDocs.queries.storyDocs.get({
              id: componentId,
            });
            if (payload === undefined || payload.error) {
              try {
                payload = await storyDocs.queries.storyDocs.loaded({ id: componentId });
              } catch {
                payload = storyDocs.queries.storyDocs.get({ id: componentId });
              }
            }
            const sourceContext =
              activeContext?.context ??
              globalThis.__STORYBOOK_PREVIEW__.getStoryContext(
                await globalThis.__STORYBOOK_PREVIEW__.loadStory({ storyId: input.storyId }),
                { forceInitialArgs: input.slot === 'initial' }
              );
            const sourceArgs =
              createDynamicSnippetInput(input.storyId, sourceContext.unmappedArgs, input.slot)
                .argsKey === input.argsKey
                ? sourceContext.unmappedArgs
                : undefined;
            const source = renderDynamicSnippetSource(input, payload, sourceContext, sourceArgs);
            const warning =
              source === undefined || payload?.stories[input.storyId]?.snippet === undefined
                ? undefined
                : selectWarningForStory(payload, input.storyId);
            const transform = activeContext?.context.parameters.docs?.source?.transform as
              | SourceTransform
              | undefined;
            let transformedSource: string | undefined;
            if (
              source !== undefined &&
              input.slot === 'current' &&
              activeContext?.context.viewMode === 'story' &&
              transform !== undefined
            ) {
              try {
                transformedSource = await transform(source, activeContext.context);
              } catch (error) {
                once.warn(
                  `Could not transform the code snippet for "${input.storyId}": ${String(error)}`
                );
              }
            }
            const record = {
              revision: dynamicSnippetRevision(payload, input.storyId),
              ...(source === undefined ? {} : { source }),
              ...(transformedSource === undefined ? {} : { transformedSource }),
              ...(warning === undefined ? {} : { warning }),
            };

            const contextIsActive =
              request.renderId === undefined ||
              Object.values(runtime.contexts.get(input.storyId) ?? {}).some(
                (candidate) => candidate?.renderId === request.renderId
              );
            if (contextIsActive && runtime.requests.get(input.storyId)?.[input.slot] === request) {
              ctx.self.setState((state) => {
                const current = selectDynamicSnippetRecord(state.records, input);
                if (
                  current?.revision !== record.revision ||
                  current.source !== record.source ||
                  current.transformedSource !== record.transformedSource ||
                  current.warning !== record.warning
                ) {
                  const storyRecords = (state.records[input.storyId] ??= {});
                  storyRecords[input.slot] = { argsKey: input.argsKey, record };
                }
              });
            }

            return record;
          } finally {
            const currentRequests = runtime.requests.get(input.storyId);
            if (currentRequests?.[input.slot] === request) {
              delete currentRequests[input.slot];
              if (!currentRequests.current && !currentRequests.initial) {
                runtime.requests.delete(input.storyId);
              }
            }
          }
        },
      },
    },
  });

export function dynamicSnippetBeforeEach(context: StoryContext): CleanupCallback | void {
  if (
    !globalThis.FEATURES?.experimentalDocgenServer ||
    !isStoryDocsSnippetEligible(context.parameters)
  ) {
    return;
  }

  const service = getService('core/dynamic-snippets', { internal: true });
  const storyId = context.id;
  const currentInput = createDynamicSnippetInput(storyId, context.unmappedArgs);
  const initialInput = createDynamicSnippetInput(storyId, context.initialArgs);
  const input =
    context.viewMode !== 'story' && currentInput.argsKey === initialInput.argsKey
      ? { ...currentInput, slot: 'initial' as const }
      : currentInput;
  const runtime = getDynamicSnippetRuntime();
  const renderId = nanoid();
  const storyContexts = runtime.contexts.get(storyId) ?? {};
  storyContexts[input.slot] = { argsKey: input.argsKey, renderId, context };
  runtime.contexts.set(storyId, storyContexts);
  void service.commands.renderDynamicSnippet({ ...input, renderId }).catch((error) => {
    once.warn(`Could not render the code snippet for "${storyId}": ${String(error)}`);
  });

  return () => {
    const currentContexts = runtime.contexts.get(storyId);
    if (currentContexts?.[input.slot]?.renderId === renderId) {
      delete currentContexts[input.slot];
      if (!currentContexts.current && !currentContexts.initial) {
        runtime.contexts.delete(storyId);
      }
    }

    const currentRequests = runtime.requests.get(storyId);
    for (const slot of ['current', 'initial'] as const) {
      if (currentRequests?.[slot]?.renderId === renderId) {
        delete currentRequests[slot];
      }
    }
    if (currentRequests && !currentRequests.current && !currentRequests.initial) {
      runtime.requests.delete(storyId);
    }
  };
}

export default () => {
  const useDynamicSnippets =
    'FEATURES' in globalThis && globalThis.FEATURES?.experimentalDocgenServer;

  if (!useDynamicSnippets) {
    return definePreviewAddon({});
  }

  return definePreviewAddon({
    beforeAll: () => {
      registerDynamicSnippetPreviewService();
    },
    beforeEach: dynamicSnippetBeforeEach,
  });
};
