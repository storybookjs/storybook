// @vitest-environment happy-dom
import { Channel } from 'storybook/internal/channels';
import type { ChannelEvent } from 'storybook/internal/channels';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HIGHLIGHT_MENU, HIGHLIGHT_MENU_CLICK, HIGHLIGHT_MENU_INTERACTION } from './constants.ts';
import { useHighlightMenu } from './manager.ts';
import type { ClickEventDetails, HighlightMenuState, HighlightMenuTarget } from './types.ts';

const IFRAME_RECT = { left: 100, top: 20, width: 800, height: 600, right: 900, bottom: 620 };

const makeDetails = (overrides: Partial<ClickEventDetails> = {}): ClickEventDetails => ({
  top: 10,
  left: 10,
  width: 50,
  height: 50,
  selectors: ['#target'],
  element: {
    localName: 'div',
    tagName: 'DIV',
  },
  ...overrides,
});

const makeTarget = (overrides: Partial<HighlightMenuTarget> = {}): HighlightMenuTarget => ({
  id: 'h1',
  html: '<div id="target"></div>',
  details: makeDetails(),
  menu: [[{ id: 'item-1', title: 'Open docs', clickable: true }]],
  ...overrides,
});

const makeState = (overrides: Partial<HighlightMenuState> = {}): HighlightMenuState => ({
  targets: [makeTarget()],
  selected: null,
  coords: { x: 400, y: 300 },
  ...overrides,
});

const mockIframe = (id: string, rect: Partial<DOMRect> = {}) => {
  const iframe = document.createElement('iframe');
  iframe.id = id;
  Object.assign(iframe.style, { display: 'block' });
  document.body.appendChild(iframe);
  const fullRect = { ...IFRAME_RECT, ...rect };
  iframe.getBoundingClientRect = () => fullRect as DOMRect;
  Object.defineProperty(iframe, 'clientWidth', { value: IFRAME_RECT.width, configurable: true });
  Object.defineProperty(iframe, 'clientHeight', { value: IFRAME_RECT.height, configurable: true });
  return iframe;
};

describe('useHighlightMenu', () => {
  let channel: Channel;
  let teardown: () => void;
  let frames: Array<FrameRequestCallback | undefined>;

  const flushFrames = () => {
    const pending = frames;
    frames = [];
    pending.forEach((callback) => callback?.(0));
  };

  const send = (payload: HighlightMenuState, refId?: string) =>
    channel.receive({
      type: HIGHLIGHT_MENU,
      args: [payload],
      from: 'preview',
      // The postMessage transport stamps the source refId onto incoming events
      refId,
    } as ChannelEvent);

  const getMenu = () => document.getElementById('storybook-highlights-menu');

  beforeEach(() => {
    vi.stubGlobal('__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED', false);
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
      frames[handle - 1] = undefined;
    });
    document.body.innerHTML = '';
    mockIframe('storybook-preview-iframe');
    channel = new Channel({});
    teardown = useHighlightMenu(channel);
  });

  afterEach(() => {
    teardown();
    flushFrames();
    vi.unstubAllGlobals();
  });

  it('renders the menu over the preview iframe, converting preview coordinates', () => {
    send(makeState());

    const menu = getMenu()!;
    expect(menu).not.toBeNull();
    expect(menu.style.display).toBe('block');
    // Preview viewport (400, 300) + iframe offset (100, 20), unclamped
    expect(menu.style.left).toBe('500px');
    expect(menu.style.top).toBe('320px');
  });

  it('accounts for iframe scaling when positioning the menu', () => {
    const iframe = document.getElementById('storybook-preview-iframe')!;
    iframe.getBoundingClientRect = () =>
      ({ ...IFRAME_RECT, width: 400, height: 300, right: 500, bottom: 320 }) as DOMRect;
    send(makeState({ coords: { x: 100, y: 100 } }));

    const menu = getMenu()!;
    // Half-scale iframe: preview (100, 100) maps to manager (100 + 50, 20 + 50)
    expect(menu.style.left).toBe('150px');
    expect(menu.style.top).toBe('70px');
  });

  it('keeps the menu in sync when the preview sends updated coordinates', () => {
    send(makeState({ coords: { x: 400, y: 300 } }));
    expect(getMenu()!.style.left).toBe('500px');

    send(makeState({ coords: { x: 200, y: 100 } }));
    expect(getMenu()!.style.left).toBe('300px');
    expect(getMenu()!.style.top).toBe('120px');
  });

  it('preserves menu contents and focus on position-only updates', () => {
    send(makeState());
    const menu = getMenu()!;
    const menuItem = menu.querySelector('.menu-list .menu-item') as HTMLButtonElement;
    expect(menuItem.tagName).toBe('BUTTON');
    menuItem.focus();
    expect(document.activeElement).toBe(menuItem);

    // Same targets and selection, new coordinates: the menu must not be rebuilt
    send(makeState({ coords: { x: 100, y: 100 } }));

    expect(getMenu()!.querySelector('.menu-list .menu-item')).toBe(menuItem);
    expect(document.activeElement).toBe(menuItem);
    expect(menu.style.left).toBe('200px');
  });

  it('rebuilds the menu when its contents change', () => {
    send(makeState());
    const menuItem = getMenu()!.querySelector('.menu-list .menu-item') as HTMLButtonElement;

    send(makeState({ targets: [makeTarget({ id: 'h2', html: '<span id="other"></span>' })] }));

    const nextItem = getMenu()!.querySelector('.menu-list .menu-item') as HTMLButtonElement;
    expect(nextItem).not.toBe(menuItem);
    expect(nextItem.textContent).toBe('Open docs');
  });

  it('constrains the menu inside a short preview', () => {
    const iframe = document.getElementById('storybook-preview-iframe')!;
    iframe.getBoundingClientRect = () => ({ ...IFRAME_RECT, height: 100, bottom: 120 }) as DOMRect;
    Object.defineProperty(iframe, 'clientHeight', { value: 100, configurable: true });

    // A preview coordinate scrolled above the viewport maps above the iframe's top edge
    send(makeState({ coords: { x: 400, y: -40 } }));

    const menu = getMenu()!;
    // Menu height is capped to the space over the short preview (100 - 2 * 5 - 15)
    expect(menu.style.maxHeight).toBe('75px');
    // The clamped position starts just inside the preview's top edge instead of above it
    expect(menu.style.top).toBe('25px');
  });

  it('keeps the menu in sync when the iframe moves or resizes in the manager', () => {
    send(makeState());
    const menu = getMenu()!;
    expect(menu.style.left).toBe('500px');

    const iframe = document.getElementById('storybook-preview-iframe')!;
    iframe.getBoundingClientRect = () => ({ ...IFRAME_RECT, left: 300, right: 1100 }) as DOMRect;
    flushFrames();

    expect(menu.style.left).toBe('700px');
  });

  it('positions the menu over the ref iframe the event came from', () => {
    mockIframe('storybook-ref-abc', { left: 500, top: 100, right: 1300, bottom: 720 });
    send(makeState({ coords: { x: 10, y: 10 } }), 'abc');

    expect(getMenu()!.style.left).toBe('510px');
    expect(getMenu()!.style.top).toBe('110px');
  });

  it('renders a selectable element list for multiple targets and forwards interactions', () => {
    const emitSpy = vi.spyOn(channel, 'emit');
    const second = makeTarget({
      id: 'h2',
      html: '<span id="other"></span>',
      details: makeDetails({
        selectors: ['#other'],
        element: {
          localName: 'span',
          tagName: 'SPAN',
        },
      }),
    });
    send(makeState({ targets: [makeTarget(), second] }));

    const menu = getMenu()!;
    const buttons = menu.querySelectorAll('.element-list li.selectable button');
    expect(buttons).toHaveLength(2);
    expect(menu.querySelector('.menu-list')).toBeNull();

    (buttons[1] as HTMLButtonElement).click();
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, {
      action: 'select',
      index: 1,
    });

    // The interaction handlers are bound to the list item (mouseenter does not bubble)
    const item = buttons[1].closest('li')!;
    item.dispatchEvent(new Event('mouseenter'));
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, { action: 'focus', index: 1 });
    item.dispatchEvent(new Event('mouseleave'));
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, { action: 'blur' });
  });

  it('renders the menu list for a single target and emits its click event on click', () => {
    const emitSpy = vi.spyOn(channel, 'emit');
    const target = makeTarget();
    send(makeState({ targets: [target] }));

    const menuItem = getMenu()!.querySelector('.menu-list .menu-item') as HTMLButtonElement;
    expect(menuItem.tagName).toBe('BUTTON');
    expect(menuItem.textContent).toBe('Open docs');

    menuItem.click();
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_CLICK, 'h1', 'item-1', target.details);
  });

  it('renders the selected target with a back button which deselects it', () => {
    const emitSpy = vi.spyOn(channel, 'emit');
    const second = makeTarget({
      id: 'h2',
      html: '<span id="other"></span>',
      details: makeDetails({
        selectors: ['#other'],
        element: {
          localName: 'span',
          tagName: 'SPAN',
        },
      }),
    });
    send(makeState({ targets: [makeTarget(), second], selected: 1 }));

    const menu = getMenu()!;
    // Only the selected element is listed, and its menu is shown directly
    expect(menu.querySelectorAll('.element-list li')).toHaveLength(1);
    expect(menu.querySelector('.menu-list')).not.toBeNull();
    const backButton = menu.querySelector('.element-list li.selected button') as HTMLButtonElement;
    expect(backButton).not.toBeNull();

    backButton.click();
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, { action: 'deselect' });
  });

  it('hides the menu when the preview reports no targets or no coordinates', () => {
    send(makeState());
    expect(getMenu()!.style.display).toBe('block');

    send(makeState({ targets: [], coords: null }));
    expect(getMenu()!.style.display).toBe('none');

    send(makeState());
    send(makeState({ coords: null }));
    expect(getMenu()!.style.display).toBe('none');
  });

  it('ignores malformed payloads without throwing', () => {
    channel.receive({ type: HIGHLIGHT_MENU, args: [null], from: 'preview' });
    channel.receive({ type: HIGHLIGHT_MENU, args: [{}], from: 'preview' });
    expect(getMenu()?.style.display ?? 'none').toBe('none');
  });

  it('clamps the menu to stay within the iframe', () => {
    send(makeState({ coords: { x: 800, y: 600 } }));

    const menu = getMenu()!;
    // clientWidth/clientHeight are 0 in happy-dom, so the clamp uses a zero-sized menu
    expect(menu.style.left).toBe('895px'); // iframe.right (900) - margin (5)
    expect(menu.style.top).toBe('600px'); // iframe.bottom (620) - margin (5) - topOffset (15)
  });

  it('cleans up the menu and stops listening on teardown', () => {
    send(makeState());
    expect(getMenu()).not.toBeNull();

    teardown();
    expect(getMenu()).toBeNull();
    expect(document.getElementById('storybook-highlights-root')).toBeNull();
    flushFrames();
    expect(frames.filter(Boolean)).toHaveLength(0);

    // Re-register after teardown to not leak the initialized guard into other tests
    vi.stubGlobal('__STORYBOOK_HIGHLIGHT_MENU_INITIALIZED', false);
    teardown = useHighlightMenu(channel);
    send(makeState());
    expect(getMenu()).not.toBeNull();
  });
});
