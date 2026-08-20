// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StoryDocsPayload } from 'storybook/internal/types';
import { registerService } from 'storybook/preview-api';

import { useServiceStorySnippet } from './use-service-story-docs.ts';
import { clearChannel, installNoopChannel } from '../../../../../core/src/channels/channel-slot.ts';
import { unregisterService } from '../../../../../core/src/shared/open-service/service-registry.ts';
import { storyDocsServiceDef } from '../../../../../core/src/shared/open-service/services/story-docs/definition.ts';

const storyId = 'button--primary';
const componentId = 'button';

const payload = (value: string): StoryDocsPayload => ({
  id: componentId,
  name: 'Button',
  path: './Button.stories.ts',
  stories: {
    [storyId]: {
      id: storyId,
      name: 'Primary',
      snippet: 'SERVER',
      snippetTemplate: { kind: 'test-template', value } as { kind: string },
    },
  },
});

const renderTemplate = (template: unknown) => (template as { value: string }).value;

beforeEach(() => {
  installNoopChannel();
});

afterEach(() => {
  unregisterService('core/story-docs');
  clearChannel();
});

describe('useServiceStorySnippet', () => {
  it('updates after an in-place change inside the selected snippet template', async () => {
    let value = 'FIRST';
    const service = registerService(storyDocsServiceDef, {
      commands: {
        extractStoryDocs: {
          handler: (input, context) => {
            const nextPayload = payload(value);
            context.self.setState((state) => {
              const current = state.components[input.id];
              if (current) {
                const template = current.stories[storyId]!.snippetTemplate as unknown as {
                  value: string;
                };
                template.value = value;
              } else {
                state.components[input.id] = nextPayload;
              }
            });
            return nextPayload;
          },
        },
        extractAllStoryDocs: {
          handler: () => {},
        },
      },
    });
    await service.commands.extractStoryDocs({ id: componentId });

    const { result } = renderHook(() => useServiceStorySnippet(storyId, {}, renderTemplate));
    expect(result.current.data).toBe('FIRST');

    value = 'SECOND';
    await act(async () => service.commands.extractStoryDocs({ id: componentId }));

    await waitFor(() => expect(result.current.data).toBe('SECOND'));
  });
});
