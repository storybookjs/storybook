import { describe, expect, it, vi } from 'vitest';

import { Addon_TypesEnum as types } from 'storybook/internal/types';

import { init as initAddons } from '../modules/addons';

const PANELS = {
  a11y: {
    title: 'Accessibility',
    paramKey: 'a11y',
  },
  actions: {
    title: 'Actions',
    paramKey: 'actions',
  },
  knobs: {
    title: 'Knobs',
    paramKey: 'knobs',
  },
};

const TEST_PROVIDERS = {
  'storybook/test/test-provider': {
    id: 'storybook/test/test-provider',
    title: 'Component tests',
  },
};

const provider = {
  getElements(type) {
    if (type === types.PANEL) {
      return PANELS;
    }
    if (type === types.experimental_TEST_PROVIDER) {
      return TEST_PROVIDERS;
    }
    return null;
  },
};

const store = {
  getState: () => ({
    selectedPanel: '',
  }),
  setState: vi.fn(),
};

describe('Addons API', () => {
  describe('#getElements', () => {
    it('should return provider elements', () => {
      const { api } = initAddons({ provider, store });

      const panels = api.getElements(types.PANEL);
      expect(panels).toBe(PANELS);

      const testProviders = api.getElements(types.experimental_TEST_PROVIDER);
      expect(testProviders).toBe(TEST_PROVIDERS);
    });
  });

  describe('#getSelectedPanel', () => {
    it('should return provider panels', () => {
      // given
      const storeWithSelectedPanel = {
        getState: () => ({
          selectedPanel: 'actions',
        }),
        setState: vi.fn(),
      };
      const { api } = initAddons({ provider, store: storeWithSelectedPanel });

      // when
      const selectedPanel = api.getSelectedPanel();

      // then
      expect(selectedPanel).toBe('actions');
    });

    it('should return first panel when selected is not a panel', () => {
      // given
      const storeWithSelectedPanel = {
        getState: () => ({
          selectedPanel: 'unknown',
        }),
        setState: vi.fn(),
      };
      const { api } = initAddons({ provider, store: storeWithSelectedPanel });

      // when
      const selectedPanel = api.getSelectedPanel();

      // then
      expect(selectedPanel).toBe('a11y');
    });
  });

  describe('#setSelectedPanel', () => {
    it('should set value inn store', () => {
      // given
      const setState = vi.fn();
      const storeWithSelectedPanel = {
        getState: () => ({
          selectedPanel: 'actions',
        }),
        setState,
      };
      const { api } = initAddons({ provider, store: storeWithSelectedPanel });
      expect(setState).not.toHaveBeenCalled();

      // when
      api.setSelectedPanel('knobs');

      // then
      expect(setState).toHaveBeenCalledWith({ selectedPanel: 'knobs' }, { persistence: 'session' });
    });
  });

  describe('#clearStatuses', () => {
    it('calls clear() on every test provider that has it', () => {
      const clearA = vi.fn();
      const clearB = vi.fn();
      const providerWithClear = {
        getElements(type) {
          if (type === types.experimental_TEST_PROVIDER) {
            return {
              'provider-a': { id: 'provider-a', clear: clearA },
              'provider-b': { id: 'provider-b', clear: clearB },
            };
          }
          return null;
        },
      };
      const { api } = initAddons({ provider: providerWithClear, store });

      api.clearStatuses();

      expect(clearA).toHaveBeenCalledOnce();
      expect(clearB).toHaveBeenCalledOnce();
    });

    it('skips providers without a clear() function', () => {
      const clearA = vi.fn();
      const providerMixed = {
        getElements(type) {
          if (type === types.experimental_TEST_PROVIDER) {
            return {
              'provider-with-clear': { id: 'provider-with-clear', clear: clearA },
              // simulates change-detection provider — no clear()
              'storybook/change-detection': { id: 'storybook/change-detection' },
            };
          }
          return null;
        },
      };
      const { api } = initAddons({ provider: providerMixed, store });

      expect(() => api.clearStatuses()).not.toThrow();
      expect(clearA).toHaveBeenCalledOnce();
    });

    it('continues clearing remaining providers when one throws', () => {
      const clearOk = vi.fn();
      const providerWithError = {
        getElements(type) {
          if (type === types.experimental_TEST_PROVIDER) {
            return {
              'provider-throws': {
                id: 'provider-throws',
                clear: () => {
                  throw new Error('boom');
                },
              },
              'provider-ok': { id: 'provider-ok', clear: clearOk },
            };
          }
          return null;
        },
      };
      const { api } = initAddons({ provider: providerWithError, store });

      expect(() => api.clearStatuses()).not.toThrow();
      expect(clearOk).toHaveBeenCalledOnce();
    });
  });
});
