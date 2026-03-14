import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { API_Provider } from 'storybook/internal/types';

import EventEmitter from 'events';
import { themes } from 'storybook/theming';

import type { ModuleArgs } from '../lib/types';
import type { SubState as AddonsSubState } from '../modules/addons';
import type { SubAPI, SubState } from '../modules/layout';
import { getDefaultLayoutState, init as initLayout } from '../modules/layout';
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
      ...getDefaultLayoutState(),
      selectedPanel: 'storybook/internal/action/panel',
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

  describe('focusOnUIElement', () => {
    let mockActiveElement: any;
    let mockGetElementById: ReturnType<typeof vi.fn>;
    let focusLayoutApi: SubAPI;

    beforeEach(async () => {
      mockActiveElement = null;
      mockGetElementById = vi.fn().mockReturnValue(null);

      // Set up mock document on globalThis before re-importing layout module.
      // @storybook/global resolves to globalThis in Node, so the layout module's
      // `const { document } = global;` will capture this mock.
      (globalThis as any).document = {
        getElementById: mockGetElementById,
        get activeElement() {
          return mockActiveElement;
        },
      };

      // Re-import the layout module so it captures our mock document
      vi.resetModules();
      const { init: freshInit } = await import('../modules/layout');
      focusLayoutApi = freshInit({
        store,
        provider,
        singleStory: false,
      } as unknown as ModuleArgs).api;
    });

    afterEach(() => {
      delete (globalThis as any).document;
      vi.restoreAllMocks();
    });

    const createMockElement = (id: string) => {
      const element = {
        id,
        focus: vi.fn(() => {
          mockActiveElement = element;
        }),
        select: vi.fn(),
      };
      mockGetElementById.mockImplementation((queryId: string) => (queryId === id ? element : null));
      return element;
    };

    it('should return false when elementId is not provided', () => {
      const result = focusLayoutApi.focusOnUIElement();
      expect(result).toBe(false);
    });

    it('should return false when elementId is undefined', () => {
      const result = focusLayoutApi.focusOnUIElement(undefined);
      expect(result).toBe(false);
    });

    it('should return true and focus element when element exists', () => {
      const element = createMockElement('test-element');
      const result = focusLayoutApi.focusOnUIElement('test-element');
      expect(result).toBe(true);
      expect(element.focus).toHaveBeenCalled();
    });

    it('should return true and call select when select option is true (boolean form)', () => {
      const element = createMockElement('test-element');
      const result = focusLayoutApi.focusOnUIElement('test-element', true);
      expect(result).toBe(true);
      expect(element.focus).toHaveBeenCalled();
      expect(element.select).toHaveBeenCalled();
    });

    it('should return true and call select when select option is true (object form)', () => {
      const element = createMockElement('test-element');
      const result = focusLayoutApi.focusOnUIElement('test-element', { select: true });
      expect(result).toBe(true);
      expect(element.focus).toHaveBeenCalled();
      expect(element.select).toHaveBeenCalled();
    });

    it('should not call select when select option is false', () => {
      const element = createMockElement('test-element');
      const result = focusLayoutApi.focusOnUIElement('test-element', { select: false });
      expect(result).toBe(true);
      expect(element.focus).toHaveBeenCalled();
      expect(element.select).not.toHaveBeenCalled();
    });

    it('should return false without polling when element does not exist and poll is false', () => {
      const result = focusLayoutApi.focusOnUIElement('nonexistent-element', { poll: false });
      expect(result).toBe(false);
    });

    it('should return a Promise when element does not exist and poll is true (default)', () => {
      const result = focusLayoutApi.focusOnUIElement('nonexistent-element');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve to true when element appears during polling', async () => {
      vi.useFakeTimers();

      const element = {
        id: 'delayed-element',
        focus: vi.fn(),
        select: vi.fn(),
      };

      // Element not available initially
      const result = focusLayoutApi.focusOnUIElement('delayed-element');
      expect(result).toBeInstanceOf(Promise);

      // Make element available and focusable
      mockGetElementById.mockImplementation((id: string) =>
        id === 'delayed-element' ? element : null
      );
      element.focus.mockImplementation(() => {
        mockActiveElement = element;
      });

      await vi.advanceTimersByTimeAsync(150);
      await expect(result).resolves.toBe(true);
      expect(element.focus).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should resolve to false when element never appears during polling', async () => {
      vi.useFakeTimers();

      const result = focusLayoutApi.focusOnUIElement('never-appears');
      expect(result).toBeInstanceOf(Promise);

      await vi.advanceTimersByTimeAsync(600);
      await expect(result).resolves.toBe(false);

      vi.useRealTimers();
    });
  });
});
