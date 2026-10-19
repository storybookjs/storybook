// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

import { init as initShortcuts } from '../modules/shortcuts';

vi.mock('storybook/internal/client-logger');

function createMockStore() {
  let state = {};
  return {
    getState: vi.fn().mockImplementation(() => state),
    setState: vi.fn().mockImplementation((update) => {
      const s = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...s };
      return state;
    }),
  };
}

const mockAddonShortcut = {
  addon: 'my-addon',
  shortcut: {
    label: 'Do something',
    defaultShortcut: ['O'],
    actionName: 'doSomething',
    action: () => {
      //
    },
  },
};

const mockAddonSecondShortcut = {
  addon: 'my-addon',
  shortcut: {
    label: 'Do something else',
    defaultShortcut: ['P'],
    actionName: 'doSomethingElse',
    action: () => {
      //
    },
  },
};

const mockSecondAddonShortcut = {
  addon: 'my-other-addon',
  shortcut: {
    label: 'Create issue',
    defaultShortcut: ['N'],
    actionName: 'createIssue',
    action: () => {
      //
    },
  },
};

describe('shortcuts api', () => {
  it('gets defaults', () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    expect(api.getDefaultShortcuts()).toHaveProperty('fullScreen', ['alt', 'F']);
  });

  it('gets defaults including addon ones', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    expect(api.getDefaultShortcuts()).toHaveProperty('fullScreen', ['alt', 'F']);
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`,
      mockAddonShortcut.shortcut.defaultShortcut
    );
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`,
      mockAddonSecondShortcut.shortcut.defaultShortcut
    );
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`,
      mockSecondAddonShortcut.shortcut.defaultShortcut
    );
  });

  it('gets addons shortcuts', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    expect(api.getAddonsShortcuts()).toStrictEqual({
      [`${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`]:
        mockAddonShortcut.shortcut,
      [`${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`]:
        mockAddonSecondShortcut.shortcut,
      [`${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`]:
        mockSecondAddonShortcut.shortcut,
    });
  });

  it('gets addons shortcut labels', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    expect(api.getAddonsShortcutLabels()).toStrictEqual({
      [`${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`]:
        mockAddonShortcut.shortcut.label,
      [`${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`]:
        mockAddonSecondShortcut.shortcut.label,
      [`${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`]:
        mockSecondAddonShortcut.shortcut.label,
    });
  });

  it('gets addons shortcut defaults', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    expect(api.getAddonsShortcutDefaults()).toStrictEqual({
      [`${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`]:
        mockAddonShortcut.shortcut.defaultShortcut,
      [`${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`]:
        mockAddonSecondShortcut.shortcut.defaultShortcut,
      [`${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`]:
        mockSecondAddonShortcut.shortcut.defaultShortcut,
    });
  });

  it('sets defaults', () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    expect(api.getShortcutKeys().fullScreen).toEqual(['alt', 'F']);
  });

  it('sets addon shortcut with default value', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    expect(api.getDefaultShortcuts()).toHaveProperty('fullScreen', ['alt', 'F']);
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`,
      mockAddonShortcut.shortcut.defaultShortcut
    );
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`,
      mockAddonSecondShortcut.shortcut.defaultShortcut
    );
    expect(api.getDefaultShortcuts()).toHaveProperty(
      `${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`,
      mockSecondAddonShortcut.shortcut.defaultShortcut
    );
  });

  it('sets defaults, augmenting anything that was persisted', () => {
    const store = createMockStore();
    store.setState({ shortcuts: { fullScreen: ['Z'] } });

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    expect(api.getShortcutKeys().fullScreen).toEqual(['Z']);
    expect(api.getShortcutKeys().togglePanel).toEqual(['alt', 'A']);
  });

  it('sets defaults, ignoring anything persisted that is out of date', () => {
    const store = createMockStore();
    store.setState({ shortcuts: { randomKey: ['Z'] } });

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    expect(api.getShortcutKeys().randomKey).not.toBeDefined();
  });

  it('sets new values', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setShortcut('fullScreen', ['X']);
    expect(api.getShortcutKeys().fullScreen).toEqual(['X']);
  });

  it('sets new values for addon shortcuts', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    const { addon, shortcut } = mockAddonShortcut;
    await api.setAddonShortcut(addon, shortcut);

    await api.setShortcut(`${addon}-${shortcut.actionName}`, ['I']);
    expect(api.getShortcutKeys()[`${addon}-${shortcut.actionName}`]).toEqual(['I']);
  });

  it('restores all defaults', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    const { addon, shortcut } = mockAddonShortcut;
    await api.setAddonShortcut(addon, shortcut);

    await api.setShortcut('fullScreen', ['X']);
    await api.setShortcut('togglePanel', ['B']);
    await api.setShortcut(`${addon}-${shortcut.actionName}`, ['I']);

    await api.restoreAllDefaultShortcuts();
    expect(api.getShortcutKeys().fullScreen).toEqual(['alt', 'F']);
    expect(api.getShortcutKeys().togglePanel).toEqual(['alt', 'A']);
    expect(api.getShortcutKeys()[`${addon}-${shortcut.actionName}`]).toEqual(
      shortcut.defaultShortcut
    );
  });

  it('restores single default', async () => {
    const store = createMockStore();

    const { api, state } = initShortcuts({ store });
    store.setState(state);

    await api.setAddonShortcut(mockAddonShortcut.addon, mockAddonShortcut.shortcut);
    await api.setAddonShortcut(mockAddonSecondShortcut.addon, mockAddonSecondShortcut.shortcut);
    await api.setAddonShortcut(mockSecondAddonShortcut.addon, mockSecondAddonShortcut.shortcut);

    await api.setShortcut('fullScreen', ['X']);
    await api.setShortcut('togglePanel', ['B']);
    await api.setShortcut(`${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`, [
      'I',
    ]);
    await api.setShortcut(
      `${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`,
      ['H']
    );
    await api.setShortcut(
      `${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`,
      ['G']
    );
    await api.restoreDefaultShortcut('fullScreen');
    await api.restoreDefaultShortcut(
      `${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`
    );

    expect(api.getShortcutKeys().fullScreen).toEqual(['alt', 'F']);
    expect(api.getShortcutKeys().togglePanel).toEqual(['B']);
    expect(
      api.getShortcutKeys()[`${mockAddonShortcut.addon}-${mockAddonShortcut.shortcut.actionName}`]
    ).toEqual(mockAddonShortcut.shortcut.defaultShortcut);
    expect(
      api.getShortcutKeys()[
        `${mockAddonSecondShortcut.addon}-${mockAddonSecondShortcut.shortcut.actionName}`
      ]
    ).toEqual(['H']);
    expect(
      api.getShortcutKeys()[
        `${mockSecondAddonShortcut.addon}-${mockSecondAddonShortcut.shortcut.actionName}`
      ]
    ).toEqual(['G']);
  });
});

describe('addon shortcut matching', () => {
  const initWithUi = () => {
    const store = createMockStore();
    const fullAPI = { getNavAvailability: () => 'shown' };
    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({ ...state, ui: { enableShortcuts: true }, storyId: 'a', refId: undefined });
    return api;
  };

  it('addon shortcuts match and fire', async () => {
    const api = initWithUi();
    const action = vi.fn();
    await api.setAddonShortcut('my-addon', {
      label: 'Do it',
      defaultShortcut: ['O'],
      actionName: 'doIt',
      action,
    });

    expect(api.handleKeydownEvent({ key: 'O', code: 'KeyO' })).toBe('my-addon-doIt');
    expect(action).toHaveBeenCalled();
  });

  it('persisted addon bindings whose addon did not re-register are ignored', () => {
    const store = createMockStore();
    const fullAPI = { getNavAvailability: () => 'shown' };
    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({
      ...state,
      ui: { enableShortcuts: true },
      shortcuts: { ...state.shortcuts, 'stale-addon-gone': ['ArrowUp'] },
    });

    expect(() => api.handleKeydownEvent({ key: 'ArrowUp' })).not.toThrow();
    expect(api.handleKeydownEvent({ key: 'ArrowUp' })).toBeUndefined();
  });

  it('handleShortcutFeature warns instead of throwing for a feature id with no registered action', () => {
    const api = initWithUi();

    expect(() => api.handleShortcutFeature('stale-addon-gone', {})).not.toThrow();
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('stale-addon-gone')
    );
  });
});

describe('keydown match gating', () => {
  it('reports no match when shortcuts are disabled, so the key is not swallowed', () => {
    const store = createMockStore();
    const fullAPI = { getNavAvailability: () => 'shown', toggleFullscreen: vi.fn() };
    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({ ...state, ui: { enableShortcuts: false }, storyId: 'a' });

    expect(api.handleKeydownEvent({ key: 'F', altKey: true })).toBeUndefined();
    expect(fullAPI.toggleFullscreen).not.toHaveBeenCalled();
  });

  it('reports no match for sidebar shortcuts while the nav is unavailable', () => {
    const store = createMockStore();
    const fullAPI = { getNavAvailability: () => 'unavailable', toggleFullscreen: vi.fn() };
    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({ ...state, ui: { enableShortcuts: true }, storyId: 'a' });

    expect(api.handleKeydownEvent({ key: 'S', code: 'KeyS', altKey: true })).toBeUndefined();
    expect(api.handleKeydownEvent({ key: 'F', altKey: true })).toBe('fullScreen');
  });

  it('reports no match for an escape binding persisted by an older Storybook, so overlays receive the key', () => {
    const store = createMockStore();
    const fullAPI = { getNavAvailability: () => 'shown' };
    const { api, state } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({
      ...state,
      ui: { enableShortcuts: true },
      shortcuts: { ...state.shortcuts, escape: ['escape'] },
    });

    expect(api.handleKeydownEvent({ key: 'Escape' })).toBeUndefined();
  });
});

describe('keydown listeners registered by init', () => {
  let fullAPI;

  const dispatch = (eventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...eventInit });
    vi.spyOn(event, 'stopPropagation');
    document.body.dispatchEvent(event);
    return event;
  };

  beforeAll(() => {
    const store = createMockStore();
    fullAPI = {
      getNavAvailability: () => 'shown',
      toggleFullscreen: vi.fn(),
      getIsFullscreen: vi.fn().mockReturnValue(false),
    };
    const { state, init } = initShortcuts({ store, provider: {}, fullAPI });
    store.setState({
      ...state,
      ui: { enableShortcuts: true },
      storyId: 'a',
      shortcuts: { ...state.shortcuts, 'stale-addon-gone': ['alt', 'shift', 'Q'] },
    });
    init();
  });

  it('stops propagation of a matched shortcut at the capture phase and runs its action', () => {
    const event = dispatch({ key: 'F', code: 'KeyF', altKey: true });

    expect(fullAPI.toggleFullscreen).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it('lets landmark navigation keys through to react-aria', () => {
    const event = dispatch({ key: 'F6', code: 'F6' });

    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves events untouched when they only match an orphaned persisted addon binding', () => {
    const event = dispatch({ key: 'Q', code: 'KeyQ', altKey: true, shiftKey: true });

    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('exits fullscreen on a bubbled Escape that no overlay consumed', () => {
    fullAPI.getIsFullscreen.mockReturnValue(true);

    const event = dispatch({ key: 'Escape' });

    expect(fullAPI.toggleFullscreen).toHaveBeenCalledWith(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not exit fullscreen when an overlay already consumed Escape', () => {
    fullAPI.getIsFullscreen.mockReturnValue(true);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    document.body.dispatchEvent(event);

    expect(fullAPI.toggleFullscreen).not.toHaveBeenCalled();
  });
});
