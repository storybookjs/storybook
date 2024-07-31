import { describe, it, expect, vi } from 'vitest';
import { Addon_TypesEnum as types } from '@storybook/core/types';
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

const provider = {
  getElements(type) {
    if (type === types.PANEL) {
      return PANELS;
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
      // given
      const { api } = initAddons({ provider, store });

      // when
      const panels = api.getElements(types.PANEL);

      // then
      expect(panels).toBe(PANELS);
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
});
