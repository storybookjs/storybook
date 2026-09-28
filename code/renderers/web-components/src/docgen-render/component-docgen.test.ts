import type { DocgenPayload } from 'storybook/internal/types';

import { logger } from 'storybook/internal/client-logger';
import { registerService } from 'storybook/preview-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { docgenServiceDef } from '../../../../core/src/shared/open-service/services/docgen/definition.ts';
import { clearRegistry } from '../../../../core/src/shared/open-service/service-registry.ts';
import type { StoryContext } from '../types.ts';
import { getComponentDocgen, loadComponentDocgen } from './component-docgen.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

describe('component docgen render access', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRegistry();
    vi.restoreAllMocks();
  });

  it('does not read the service when the flag is off', async () => {
    const handler = vi.fn();
    const context = { id: 'card-a--front', componentId: 'card-a' } as StoryContext;

    await loadComponentDocgen(context);

    expect(handler).not.toHaveBeenCalled();
    expect(getComponentDocgen(context)).toBeUndefined();
  });

  it('loads and reads the component docgen when the flag is on', async () => {
    const payload: DocgenPayload = {
      id: 'card-b',
      name: 'x-card',
      path: './x.stories.ts',
      jsDocTags: {},
      argTypes: { label: { name: 'label' } },
    };
    const handler = registerDocgen(payload);
    const context = { id: 'card-b--front', componentId: 'card-b' } as StoryContext;
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });

    await loadComponentDocgen(context);

    expect(handler).toHaveBeenCalledOnce();
    expect(getComponentDocgen(context)).toEqual(payload);
  });

  it('warns when component docgen loading rejects', async () => {
    const error = new Error('missing server');
    const handler = registerRejectingDocgen(error);
    const context = { id: 'card-c--front', componentId: 'card-c' } as StoryContext;
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });

    await loadComponentDocgen(context);

    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      'Server docgen for "card-c" did not load, args are assigned as properties: missing server'
    );
    expect(getComponentDocgen(context)).toBeUndefined();
    expect(handler).toHaveBeenCalledOnce();
  });
});

function registerDocgen(payload: DocgenPayload): ReturnType<typeof vi.fn> {
  const handler = vi.fn();

  registerService(docgenServiceDef, {
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          handler();
          ctx.self.setState((state) => {
            state.components[input.id] = payload;
          });
          return payload;
        },
      },
    },
  });

  return handler;
}

function registerRejectingDocgen(error: Error): ReturnType<typeof vi.fn> {
  const handler = vi.fn();

  registerService(docgenServiceDef, {
    commands: {
      extractDocgen: {
        handler: async () => {
          handler();
          throw error;
        },
      },
    },
  });

  return handler;
}
