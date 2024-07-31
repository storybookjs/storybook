import { describe, it, expect, vi } from 'vitest';
import { init as initShortcuts } from '../modules/shortcuts';

function createMockStore() {
  let state = {};
  return {
    getState: vi.fn().mockImplementation(() => state),
    setState: vi.fn().mockImplementation((s) => {
      state = { ...state, ...s };
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
