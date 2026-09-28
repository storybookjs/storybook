/** @vitest-environment happy-dom */
import type { DocgenPayload, StoryContextForRender } from 'storybook/internal/types';

import { Channel, setChannel } from 'storybook/internal/channels';
import { action } from 'storybook/actions';
import { registerService } from 'storybook/preview-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { docgenServiceDef } from '../../../core/src/shared/open-service/services/docgen/definition.ts';
import { clearRegistry } from '../../../core/src/shared/open-service/service-registry.ts';
import { ARG_TYPE_CATEGORIES } from './docgen/component-docgen/arg-types/categories.ts';
import { loadComponentDocgen } from './docgen-render/component-docgen.ts';
import { render } from './render.ts';
import type { WebComponentsRenderer } from './types.ts';

vi.mock('storybook/actions', () => ({ action: vi.fn(() => vi.fn()) }));

const CONTEXT = {
  id: 'x-card--a',
  componentId: 'x-card',
  component: 'x-card',
  parameters: {},
  argTypes: {},
} as StoryContextForRender<WebComponentsRenderer>;

describe('render', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearRegistry();
    vi.clearAllMocks();
  });

  it('assigns args as properties and calls no action when the flag is off', () => {
    const element = render({ label: 'x' }, CONTEXT) as HTMLElement & { label?: string };

    expect(element.localName).toBe('x-card');
    expect(element.label).toBe('x');
    expect(action).not.toHaveBeenCalled();
  });

  it('creates action args from server argTypes and binds attributes', async () => {
    const handler = vi.fn();
    vi.mocked(action).mockReturnValue(handler);
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    registerDocgen({
      id: 'x-card',
      name: 'x-card',
      path: './x-card.ts',
      jsDocTags: {},
      argTypes: {
        label: {
          name: 'label',
          table: { category: ARG_TYPE_CATEGORIES.attributes },
        },
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      },
    });

    await loadComponentDocgen(CONTEXT);
    const element = render({ label: 'x' }, CONTEXT) as HTMLElement;
    const event = new CustomEvent('my-change');
    element.dispatchEvent(event);

    expect(action).toHaveBeenCalledWith('onMyChange');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
    expect(element.getAttribute('label')).toBe('x');
  });

  it('does not create action args when actions are disabled', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    registerDocgen({
      id: 'x-card',
      name: 'x-card',
      path: './x-card.ts',
      jsDocTags: {},
      argTypes: {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      },
    });

    await loadComponentDocgen(CONTEXT);
    const element = render({}, {
      ...CONTEXT,
      parameters: { actions: { disable: true } },
    } as StoryContextForRender<WebComponentsRenderer>) as HTMLElement;
    const event = new CustomEvent('my-change');
    element.dispatchEvent(event);

    expect(action).not.toHaveBeenCalled();
  });
});

function registerDocgen(payload: DocgenPayload): void {
  // happy-dom files start without an addons channel; registerService throws without one.
  setChannel(new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } }));
  registerService(docgenServiceDef, {
    commands: {
      extractDocgen: {
        handler: async (input, ctx) => {
          ctx.self.setState((state) => {
            state.components[input.id] = payload;
          });
          return payload;
        },
      },
    },
  });
}
