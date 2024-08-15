import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { themes } from '@storybook/core/theming';
import type { API_Provider } from '@storybook/core/types';

import EventEmitter from 'events';

import type { ModuleArgs } from '../lib/types';
import type { SubState as AddonsSubState } from '../modules/addons';
import type { SubAPI, SubState } from '../modules/layout';
import { defaultLayoutState, init as initLayout } from '../modules/layout';
import type { API, State } from '../root';
import type Store from '../store';

describe('layout API', () => {
  let layoutApi: SubAPI;
  let store: Store;
  let provider: API_Provider<API>;
  let currentState: SubState & {
    selectedPanel: AddonsSubState['selectedPanel'];
    singleStory?: boolean;
  };

  beforeEach(() => {
    currentState = {
      ...defaultLayoutState,
      selectedPanel: '@storybook/core/actions/panel',
      theme: themes.light,
      singleStory: false,
    };
    store = {
      getState: () => currentState as unknown as State,
      setState: vi.fn(async (patch) => {
        currentState = {
          ...currentState,
          ...(typeof patch === 'function' ? patch(currentState as unknown as State) : patch),
        };
        return currentState as unknown as State;
      }),
    } as unknown as Store;
    provider = {
      getConfig: vi.fn(() => ({})),
      channel: new EventEmitter(),
    } as unknown as API_Provider<API>;
    layoutApi = initLayout({
      store,
      provider,
      singleStory: false,
    } as unknown as ModuleArgs).api;
  });

  describe('toggleFullscreen', () => {
    it('should toggle fullscreen', () => {
      // start not in fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.toggleFullscreen();

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // back to not in fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
    it('should toggle fullscreen to recent visible sizes', () => {
      // start not in fullscreen
      expect(currentState.layout.navSize).toBe(300);
      expect(currentState.layout.bottomPanelHeight).toBe(300);
      expect(currentState.layout.rightPanelWidth).toBe(400);

      layoutApi.setSizes({
        navSize: 100,
        bottomPanelHeight: 200,
        rightPanelWidth: 250,
      });

      layoutApi.toggleFullscreen();

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // back to recent visible sizes, not default size
      expect(currentState.layout.navSize).toBe(100);
      expect(currentState.layout.bottomPanelHeight).toBe(200);
      expect(currentState.layout.rightPanelWidth).toBe(250);
    });
    it('should toggle fullscreen with argument', () => {
      // start not in fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.toggleFullscreen(false);

      // nothing should change
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.toggleFullscreen(true);

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      // nothing should change
      layoutApi.toggleFullscreen(true);

      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen(false);

      // now out of fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
    it('should toggle fullscreen when nav is hidden', () => {
      layoutApi.toggleNav(false);
      // start not in fullscreen
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.toggleFullscreen();

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0); // unchanged
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // now out of fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0); // shown
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
    it('should toggle fullscreen when panel is hidden', () => {
      layoutApi.togglePanel(false);
      // start not in fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0); // unchanged
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // now out of fullscreen
      expect(currentState.layout.navSize).toBeGreaterThan(0); // shown
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
    it('should NOT show nav when disabling fullscreen with singleStory=true', () => {
      store.setState((current) => ({
        singleStory: true,
        layout: { ...current.layout, navSize: 0 },
      }));
      layoutApi = initLayout({ store, provider, singleStory: true } as unknown as ModuleArgs).api;

      // start not in fullscreen, nav hidden
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.toggleFullscreen();

      // now in fullscreen
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.toggleFullscreen();

      // back to not in fullscreen, nav still hidden
      expect(currentState.layout.navSize).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
  });

  describe('toggleNav', () => {
    it('should toggle navigation', () => {
      // start default, nav shown
      expect(currentState.layout.navSize).toBeGreaterThan(0);

      layoutApi.toggleNav();

      expect(currentState.layout.navSize).toBe(0);

      layoutApi.toggleNav();

      expect(currentState.layout.navSize).toBeGreaterThan(0);
    });
    it('should toggle navigation with argument', () => {
      // start default, nav shown
      expect(currentState.layout.navSize).toBeGreaterThan(0);

      layoutApi.toggleNav(true);

      // nothing should change
      expect(currentState.layout.navSize).toBeGreaterThan(0);

      layoutApi.toggleNav(false);

      // should hide nav
      expect(currentState.layout.navSize).toBe(0);

      layoutApi.toggleNav(false);

      // nothing should change
      expect(currentState.layout.navSize).toBe(0);

      layoutApi.toggleNav(true);

      // should show nav
      expect(currentState.layout.navSize).toBeGreaterThan(0);
    });
    it('should toggle navigation to recent visible size', () => {
      // start default, nav shown
      expect(currentState.layout.navSize).toBe(300);

      layoutApi.setSizes({
        navSize: 100,
      });

      layoutApi.toggleNav();

      expect(currentState.layout.navSize).toBe(0);

      layoutApi.toggleNav();

      expect(currentState.layout.navSize).toBe(100);
    });
    it('should NOT toggle navigation when singleStory=true', () => {
      store.setState((current) => ({
        singleStory: true,
        layout: { ...current.layout, navSize: 0 },
      }));
      layoutApi = initLayout({ store, provider, singleStory: true } as unknown as ModuleArgs).api;

      layoutApi.toggleNav();
      expect(currentState.layout.navSize).toBe(0);
    });
  });

  describe('togglePanel', () => {
    it('should toggle panel', () => {
      // start default, panel shown
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);

      layoutApi.togglePanel();

      expect(currentState.layout.rightPanelWidth).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);

      layoutApi.togglePanel();

      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
    });
    it('should toggle panel with argument', () => {
      // start default, panel shown
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.togglePanel(true);

      // nothing should change
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);

      layoutApi.togglePanel(false);

      // should hide panel
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.togglePanel(false);

      // nothing should change
      expect(currentState.layout.bottomPanelHeight).toBe(0);
      expect(currentState.layout.rightPanelWidth).toBe(0);

      layoutApi.togglePanel(true);

      // should show panel
      expect(currentState.layout.bottomPanelHeight).toBeGreaterThan(0);
      expect(currentState.layout.rightPanelWidth).toBeGreaterThan(0);
    });
    it('should toggle to recent visible size', () => {
      // start default, panel shown
      expect(currentState.layout.rightPanelWidth).toBe(400);
      expect(currentState.layout.bottomPanelHeight).toBe(300);

      layoutApi.setSizes({
        rightPanelWidth: 350,
        bottomPanelHeight: 250,
      });

      layoutApi.togglePanel();

      expect(currentState.layout.rightPanelWidth).toBe(0);
      expect(currentState.layout.bottomPanelHeight).toBe(0);

      layoutApi.togglePanel();

      // should show panel with recent visible size, not default size
      expect(currentState.layout.rightPanelWidth).toBe(350);
      expect(currentState.layout.bottomPanelHeight).toBe(250);
    });
  });

  describe('togglePanelPosition', () => {
    it('should toggle panel position', () => {
      // start default, panel on the bottom
      expect(currentState.layout.panelPosition).toBe('bottom');

      layoutApi.togglePanelPosition();

      expect(currentState.layout.panelPosition).toBe('right');

      layoutApi.togglePanelPosition();

      expect(currentState.layout.panelPosition).toBe('bottom');
    });
    it('should toggle panel position with argument', () => {
      // start default, panel on the bottom
      expect(currentState.layout.panelPosition).toBe('bottom');

      layoutApi.togglePanelPosition('bottom');

      // nothing should change
      expect(currentState.layout.panelPosition).toBe('bottom');

      layoutApi.togglePanelPosition('right');

      // move to the right
      expect(currentState.layout.panelPosition).toBe('right');

      layoutApi.togglePanelPosition('right');

      // nothing should change
      expect(currentState.layout.panelPosition).toBe('right');

      layoutApi.togglePanelPosition('bottom');

      // move to the bottom
      expect(currentState.layout.panelPosition).toBe('bottom');
    });
  });

  describe('setSizes', () => {
    it('should set all sizes', () => {
      // start default
      expect(currentState.layout.navSize).toBe(300);
      expect(currentState.layout.bottomPanelHeight).toBe(300);
      expect(currentState.layout.rightPanelWidth).toBe(400);

      layoutApi.setSizes({
        navSize: 100,
        bottomPanelHeight: 200,
        rightPanelWidth: 300,
      });

      expect(currentState.layout.navSize).toBe(100);
      expect(currentState.layout.bottomPanelHeight).toBe(200);
      expect(currentState.layout.rightPanelWidth).toBe(300);
    });
    it('should set a subset of sizes', () => {
      // start default
      expect(currentState.layout.navSize).toBe(300);
      expect(currentState.layout.bottomPanelHeight).toBe(300);
      expect(currentState.layout.rightPanelWidth).toBe(400);

      layoutApi.setSizes({
        navSize: 100,
      });

      expect(currentState.layout.navSize).toBe(100);
      expect(currentState.layout.bottomPanelHeight).toBe(300); // unchanged
      expect(currentState.layout.rightPanelWidth).toBe(400); // unchanged
    });
    it('should set recentVisibleSizes when setting sizes', () => {
      // start default
      expect(currentState.layout.navSize).toBe(300);
      expect(currentState.layout.bottomPanelHeight).toBe(300);
      expect(currentState.layout.rightPanelWidth).toBe(400);

      expect(currentState.layout.recentVisibleSizes.navSize).toBe(300);
      expect(currentState.layout.recentVisibleSizes.bottomPanelHeight).toBe(300);
      expect(currentState.layout.recentVisibleSizes.rightPanelWidth).toBe(400);

      layoutApi.setSizes({
        navSize: 50,
        bottomPanelHeight: 100,
        rightPanelWidth: 150,
      });

      expect(currentState.layout.recentVisibleSizes.navSize).toBe(50);
      expect(currentState.layout.recentVisibleSizes.bottomPanelHeight).toBe(100);
      expect(currentState.layout.recentVisibleSizes.rightPanelWidth).toBe(150);

      layoutApi.setSizes({
        navSize: 0,
        bottomPanelHeight: 0,
        rightPanelWidth: 0,
      });

      // recent visible sizes should not change when being set to 0
      expect(currentState.layout.recentVisibleSizes.navSize).toBe(50);
      expect(currentState.layout.recentVisibleSizes.bottomPanelHeight).toBe(100);
      expect(currentState.layout.recentVisibleSizes.rightPanelWidth).toBe(150);
    });
  });

  describe('setOptions', () => {
    const getLastSetStateArgs = () => {
      const { calls } = (store.setState as Mock).mock;
      return calls[calls.length - 1];
    };

    it('should not change selectedPanel if it is undefined in the options', () => {
      layoutApi.setOptions({});

      expect(getLastSetStateArgs()).toBeUndefined();
    });

    it('should not change selectedPanel if it is undefined in the options, but something else has changed', () => {
      layoutApi.setOptions({ panelPosition: 'right' });

      expect(getLastSetStateArgs()[0].selectedPanel).toBeUndefined();
    });

    it('should not change selectedPanel if it is currently the same', () => {
      const panelName = currentState.selectedPanel;
      layoutApi.setOptions({});
      // second call is needed to overwrite initial layout
      layoutApi.setOptions({ selectedPanel: panelName });

      expect(getLastSetStateArgs()).toBeUndefined();
    });

    it('should not change selectedPanel if it is currently the same, but something else has changed', () => {
      layoutApi.setOptions({});
      // second call is needed to overwrite initial layout
      layoutApi.setOptions({ panelPosition: 'right', selectedPanel: currentState.selectedPanel });

      expect(getLastSetStateArgs()[0].selectedPanel).toBeUndefined();
    });

    it('should set selectedPanel initially', () => {
      const panelName = 'storybook/a11y/panel';
      layoutApi.setOptions({ selectedPanel: panelName });

      expect(getLastSetStateArgs()[0].selectedPanel).toEqual(panelName);
    });

    it('should change selectedPanel if it is defined in the options and is different', () => {
      const panelName = 'storybook/a11y/panel';
      layoutApi.setOptions({});
      layoutApi.setOptions({ selectedPanel: panelName });

      expect(getLastSetStateArgs()[0].selectedPanel).toEqual(panelName);
    });
  });

  describe('state getters', () => {
    it('should get navShown with getIsNavShown', () => {
      expect(layoutApi.getIsNavShown()).toBe(true);

      layoutApi.toggleNav();

      expect(layoutApi.getIsNavShown()).toBe(false);

      layoutApi.toggleFullscreen();

      expect(layoutApi.getIsNavShown()).toBe(false);

      layoutApi.toggleFullscreen();

      expect(layoutApi.getIsNavShown()).toBe(true);
    });

    it('should get panelShwon with getIsPanelShown', () => {
      expect(layoutApi.getIsPanelShown()).toBe(true);

      layoutApi.togglePanel();

      expect(layoutApi.getIsPanelShown()).toBe(false);

      layoutApi.toggleFullscreen();

      expect(layoutApi.getIsPanelShown()).toBe(false);

      layoutApi.toggleFullscreen();

      expect(layoutApi.getIsPanelShown()).toBe(true);
    });

    it('should get fullscreen with getIsFullscreen', () => {
      expect(layoutApi.getIsFullscreen()).toBe(false);

      layoutApi.toggleNav();

      // still not fullscreen
      expect(layoutApi.getIsFullscreen()).toBe(false);

      layoutApi.togglePanel();

      // now it is fullscreen
      expect(layoutApi.getIsFullscreen()).toBe(true);

      layoutApi.toggleFullscreen();

      // not fullscreen anymore
      expect(layoutApi.getIsFullscreen()).toBe(false);
    });
  });
});
