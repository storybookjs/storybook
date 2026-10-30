import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Addon_BaseType } from 'storybook/internal/types';

import type { API, State } from 'storybook/manager-api';

import { withInstanceGlobals } from './docs-page.ts';
import {
  instanceTools,
  scopeManagerApi,
  scopeManagerState,
  type InstanceScope,
} from './instance-manager-api.ts';
import type { DocsArticleModel, StoryArgs, StoryInstance } from './page-model.ts';

const managerGlobals: StoryArgs = { theme: 'light' };

function instance(instanceId: string, storyId: string): StoryInstance {
  return {
    instanceId,
    storyId,
    importSource: './Button.stories',
    exportName: 'Primary',
    focus: false,
    documentOrder: 0,
    position: { line: 1, column: 1 },
    args: {},
    argsFromIndex: false,
    globals: structuredClone(managerGlobals),
  };
}

function baseApi() {
  const parameters: Record<string, Record<string, unknown>> = {
    'button--primary': { viewport: { options: { phone: {} } } },
  };
  return {
    getGlobals: vi.fn(() => managerGlobals),
    getUserGlobals: vi.fn(() => managerGlobals),
    getStoryGlobals: vi.fn(() => ({})),
    updateGlobals: vi.fn(),
    setAddonShortcut: vi.fn(),
    getData: vi.fn((storyId: string) => ({ id: storyId, type: 'story' })),
    getParameters: vi.fn(
      (storyId: string, key?: string) =>
        (key ? parameters[storyId]?.[key] : parameters[storyId]) ?? null
    ),
    getCurrentParameter: vi.fn((key: string) => (key === 'layout' ? 'centered' : undefined)),
    getUrlState: vi.fn(() => ({
      viewMode: 'docs',
      storyId: 'page--docs',
      path: '/docs/page--docs',
    })),
  };
}

describe('instance-scoped manager api', () => {
  let base: ReturnType<typeof baseApi>;
  let model: DocsArticleModel;
  let onGlobalsChange: InstanceScope['onGlobalsChange'];

  beforeEach(() => {
    base = baseApi();
    model = {
      blocks: [],
      instances: [instance('a', 'button--primary'), instance('b', 'button--secondary')],
    };
    onGlobalsChange = vi.fn((instanceId: string, globals: StoryArgs) => {
      model = withInstanceGlobals(model, instanceId, globals);
    });
  });

  const scoped = (instanceId: string) => {
    const own = model.instances.find((item) => item.instanceId === instanceId)!;
    return scopeManagerApi(base as unknown as API, {
      instanceId,
      storyId: own.storyId,
      globals: own.globals,
      onGlobalsChange,
    });
  };

  it('sends a tool global update to its own instance and leaves the sibling and manager alone', () => {
    scoped('a').updateGlobals({ outline: true });

    expect(onGlobalsChange).toHaveBeenCalledWith('a', { theme: 'light', outline: true });
    expect(base.updateGlobals).not.toHaveBeenCalled();
    expect(scoped('a').getGlobals()).toEqual({ theme: 'light', outline: true });
    expect(scoped('b').getGlobals()).toEqual({ theme: 'light' });
    expect(model.instances[1]!.globals).toEqual({ theme: 'light' });
    expect(managerGlobals).toEqual({ theme: 'light' });

    scoped('b').updateGlobals({ viewport: { value: 'mobile1', isRotated: false } });
    expect(scoped('a').getUserGlobals()).toEqual({ theme: 'light', outline: true });
    expect(scoped('b').getUserGlobals()).toEqual({
      theme: 'light',
      viewport: { value: 'mobile1', isRotated: false },
    });
  });

  it('presents the instance as the selected story in story view mode', () => {
    const api = scoped('a');

    expect(api.getUrlState()).toMatchObject({ viewMode: 'story', storyId: 'button--primary' });
    expect(api.getCurrentStoryData()).toEqual({ id: 'button--primary', type: 'story' });
    expect(api.getCurrentParameter('viewport')).toEqual({ options: { phone: {} } });
    expect(api.getCurrentParameter('layout')).toBe('centered');
    expect(api.getStoryGlobals()).toEqual({});

    api.setAddonShortcut('outline', {
      label: 'Toggle Outline',
      defaultShortcut: ['alt', 'O'],
      actionName: 'outline',
      action: () => {},
    });
    expect(base.setAddonShortcut).not.toHaveBeenCalled();

    const state = scopeManagerState({ storyId: 'page--docs', viewMode: 'docs' } as State, {
      instanceId: 'a',
      storyId: 'button--primary',
      globals: { outline: true },
      onGlobalsChange,
    });
    expect(state).toMatchObject({
      storyId: 'button--primary',
      viewMode: 'story',
      globals: { outline: true },
      userGlobals: { outline: true },
      storyGlobals: {},
    });
  });

  it('keeps the registered tools that match story view for this story', () => {
    const tool = (id: string, match?: Addon_BaseType['match']) =>
      ({ id, title: id, type: 'tool', render: () => null, match }) as Addon_BaseType;
    const tools = [
      tool('outline', ({ viewMode }) => !!viewMode?.match(/^(story|docs)$/)),
      tool('viewport', ({ viewMode }) => viewMode === 'story'),
      tool('docs-only', ({ viewMode }) => viewMode === 'docs'),
      tool('always'),
    ];

    expect(
      instanceTools(tools, { storyId: 'button--primary' }, {
        path: '/docs/x',
        location: undefined,
      } as unknown as State).map((item) => item.id)
    ).toEqual(['outline', 'viewport', 'always']);
  });
});
