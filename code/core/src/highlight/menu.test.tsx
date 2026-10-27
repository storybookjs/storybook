// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { Channel } from 'storybook/internal/channels';
import type { ChannelEvent } from 'storybook/internal/channels';
import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NormalLink } from '../components/components/tooltip/TooltipLinkList.tsx';
import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_CLICK,
  HIGHLIGHT_MENU_INTERACTION,
  RESET_HIGHLIGHT,
} from './constants.ts';
import { buildMenuLinks, useHighlightMenu } from './menu.tsx';
import { HighlightRegistry } from './registry.ts';
import type { ClickEventDetails, HighlightMenuState, HighlightMenuTarget } from './types.ts';

const IFRAME_RECT = { left: 100, top: 20, width: 800, height: 600, right: 900, bottom: 620 };

const clickLink = (link: NormalLink) => link.onClick?.(new MouseEvent('click') as any, {} as any);

const makeDetails = (overrides: Partial<ClickEventDetails> = {}): ClickEventDetails => ({
  top: 10,
  left: 10,
  width: 50,
  height: 50,
  selectors: ['#target'],
  element: { localName: 'div', tagName: 'DIV' },
  ...overrides,
});

const makeTarget = (overrides: Partial<HighlightMenuTarget> = {}): HighlightMenuTarget => ({
  key: '1',
  id: 'h1',
  label: 'div#target',
  details: makeDetails(),
  ...overrides,
});

type OpenMenuState = Extract<HighlightMenuState, { open: true }>;

const makeState = (overrides: Partial<OpenMenuState> = {}): OpenMenuState => ({
  open: true,
  targets: [makeTarget()],
  selected: null,
  coords: { x: 400, y: 300 },
  ...overrides,
});

const mockIframe = (id: string, rect: Partial<DOMRect> = {}) => {
  const iframe = document.createElement('iframe');
  iframe.id = id;
  const fullRect = { ...IFRAME_RECT, ...rect };
  iframe.getBoundingClientRect = () => fullRect as DOMRect;
  Object.defineProperty(iframe, 'clientWidth', { value: IFRAME_RECT.width, configurable: true });
  Object.defineProperty(iframe, 'clientHeight', { value: IFRAME_RECT.height, configurable: true });
  document.body.appendChild(iframe);
  return iframe;
};

const createApi = (channel: Channel, refs: Record<string, unknown> = {}) =>
  ({
    getChannel: () => channel,
    getRefs: () => refs,
    emit: (type: string, data: any, ...args: any[]) => {
      if (
        data?.options?.target &&
        data.options.target !== 'storybook-preview-iframe' &&
        !data.options.target.startsWith('storybook-ref-')
      ) {
        data.options.target =
          data.options.target !== 'storybook_internal'
            ? `storybook-ref-${data.options.target}`
            : 'storybook-preview-iframe';
      }
      channel.emit(type, data, ...args);
    },
  }) as any;

describe('buildMenuLinks', () => {
  const registry = new HighlightRegistry();

  beforeEach(() => {
    registry.reset({});
    registry.add(
      { source: 'https://preview.example/' },
      {
        id: 'h1',
        selectors: ['#target'],
        menu: [
          [{ id: 'item-1', title: 'Open docs', clickable: true }],
          [{ id: 'item-2', title: 'Details', description: 'More info' }],
        ],
      }
    );
    registry.add(
      { source: 'https://preview.example/' },
      {
        id: 'h2',
        selectors: ['#other'],
        menu: [[{ id: 'item-3', title: 'Other' }]],
      }
    );
  });

  const build = (state: OpenMenuState, onInteraction = vi.fn(), onMenuClick = vi.fn()) => ({
    links: buildMenuLinks({
      state,
      registry,
      onInteraction,
      onMenuClick,
    }),
    onInteraction,
    onMenuClick,
  });

  it('renders a non-interactive label and the menu for a single target', () => {
    const { links, onMenuClick } = build(makeState());

    expect(links).toHaveLength(3);
    const elementLink = links[0]![0] as NormalLink;
    expect(elementLink.onClick).toBeUndefined();
    expect(elementLink.as).toBe('div');
    expect(links.slice(1).map((group) => (group[0] as NormalLink).title)).toEqual([
      'Open docs',
      'Details',
    ]);

    const clickable = links[1]![0] as NormalLink;
    clickLink(clickable);
    expect(onMenuClick).toHaveBeenCalledWith(makeTarget(), 'item-1');

    const nonClickable = links[2]![0] as NormalLink;
    expect(nonClickable.onClick).toBeUndefined();
    expect(nonClickable.as).toBe('div');
  });

  it('renders selectable targets and forwards hover and select interactions', () => {
    const { links, onInteraction } = build(
      makeState({
        targets: [makeTarget(), makeTarget({ key: '2', id: 'h2', label: 'span#other' })],
      })
    );

    const first = links[0]![0] as NormalLink;
    const second = links[0]![1] as NormalLink;
    expect(first.onClick).toBeDefined();
    expect(first.right).toBeDefined();
    expect(first.autoFocus).toBe(true);
    expect(links).toHaveLength(1);

    clickLink(second);
    expect(onInteraction).toHaveBeenCalledWith({ action: 'select', key: '2' });

    first.onMouseEnter?.(new MouseEvent('mouseenter') as any);
    expect(onInteraction).toHaveBeenCalledWith({ action: 'focus', key: '1' });

    first.onMouseLeave?.(new MouseEvent('mouseleave') as any);
    expect(onInteraction).toHaveBeenCalledWith({ action: 'blur' });
  });

  it('renders a selected target with a back button and its menu', () => {
    const { links, onInteraction } = build(
      makeState({
        targets: [makeTarget(), makeTarget({ key: '2', id: 'h2', label: 'span#other' })],
        selected: '2',
      })
    );

    const back = links[0]![0] as NormalLink;
    expect(links[0]).toHaveLength(1);
    expect(back.icon).toBeDefined();
    expect(back.autoFocus).toBe(true);
    clickLink(back);
    expect(onInteraction).toHaveBeenCalledWith({ action: 'deselect' });
    expect(links[1]!.map((link) => link.title)).toEqual(['Other']);
  });

  it('resolves the menu from the highlight that matched the target', () => {
    const { links } = build(
      makeState({
        targets: [
          makeTarget({
            id: 'h2',
            label: 'span#other',
            details: makeDetails({ selectors: ['#other'] }),
          }),
        ],
      })
    );

    expect(links[1]!.map((link) => link.title)).toEqual(['Other']);
  });
});

describe('useHighlightMenu', () => {
  let channel: Channel;
  let api: ReturnType<typeof createApi>;

  const send = (payload: unknown, refId?: string) =>
    act(() => {
      channel.receive({
        type: HIGHLIGHT_MENU,
        args: [payload],
        from: 'preview',
        refId,
        source: 'https://preview.example/',
      } as ChannelEvent);
    });

  const receive = (type: string, args: unknown[], refId?: string) =>
    act(() => {
      channel.receive({
        type,
        args,
        from: 'preview',
        refId,
        source: 'https://preview.example/',
      } as ChannelEvent);
    });

  const renderMenu = (refs: Record<string, unknown> = {}) => {
    api = createApi(channel, refs);
    const hook = renderHook(() => useHighlightMenu(api));
    // Register these as manager-local highlights so they apply to the host and every ref frame.
    act(() => {
      channel.emit(HIGHLIGHT, {
        id: 'h1',
        selectors: ['#target'],
        menu: [[{ id: 'item-1', title: 'Open docs', clickable: true }]],
      });
      channel.emit(HIGHLIGHT, {
        id: 'h2',
        selectors: ['#other'],
        menu: [[{ id: 'item-2', title: 'Other' }]],
      });
    });
    return hook;
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    channel = new Channel({});
    mockIframe('storybook-preview-iframe');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens at the reported coordinates and resolves menu content from the registry', () => {
    const { result } = renderMenu();

    send(makeState());

    expect(result.current.open).toBe(true);
    expect(result.current.anchor).toEqual({ x: 500, y: 320 });
    expect(result.current.links).toHaveLength(2);
    expect(result.current.links[1]![0]!.title).toBe('Open docs');
  });

  it('accounts for iframe scaling', () => {
    const iframe = document.getElementById('storybook-preview-iframe')!;
    iframe.getBoundingClientRect = () =>
      ({ ...IFRAME_RECT, width: 400, height: 300, right: 500, bottom: 320 }) as DOMRect;
    const { result } = renderMenu();

    send(makeState({ coords: { x: 100, y: 100 } }));

    expect(result.current.anchor).toEqual({ x: 150, y: 70 });
  });

  it('ignores malformed states and hides the menu for a closed state', () => {
    const { result } = renderMenu();

    send(makeState());
    expect(result.current.open).toBe(true);

    send({ open: true, targets: [null], selected: null, coords: { x: 0, y: 0 } });
    send({ targets: [], selected: null, coords: null });
    expect(result.current.open).toBe(true);

    send({ open: false });
    expect(result.current.open).toBe(false);
  });

  it('only lets the frame that owns the menu close it', () => {
    mockIframe('storybook-ref-abc');
    const { result } = renderMenu({ abc: { id: 'abc' } });

    send(makeState());
    expect(result.current.open).toBe(true);

    // A hidden ref resetting must not close the host preview's menu
    send({ open: false }, 'abc');
    receive(STORY_RENDER_PHASE_CHANGED, [{ newPhase: 'loading' }], 'abc');
    expect(result.current.open).toBe(true);

    send({ open: false });
    expect(result.current.open).toBe(false);
  });

  it('hides the menu when the preview iframe is missing or has no size', () => {
    const { result, rerender } = renderMenu();
    send(makeState());
    expect(result.current.open).toBe(true);

    const iframe = document.getElementById('storybook-preview-iframe')!;
    iframe.getBoundingClientRect = () => ({ ...IFRAME_RECT, width: 0, height: 0 }) as DOMRect;
    rerender();
    expect(result.current.open).toBe(false);

    iframe.remove();
    rerender();
    expect(result.current.open).toBe(false);
  });

  it('routes interactions to the ref frame the menu came from', () => {
    mockIframe('storybook-ref-abc', { left: 500, top: 100, right: 1300, bottom: 720 });
    const { result } = renderMenu({ abc: { id: 'abc' } });
    const emitSpy = vi.spyOn(channel, 'emit');

    send(
      makeState({
        targets: [makeTarget(), makeTarget({ key: '2', id: 'h2', label: 'span#other' })],
      }),
      'abc'
    );
    expect(result.current.anchor).toEqual({ x: 900, y: 400 });

    const second = result.current.links[0]![1] as NormalLink;
    clickLink(second);
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, {
      action: 'select',
      key: '2',
      options: { target: 'storybook-ref-abc' },
    });
  });

  it('emits menu clicks with the target details', () => {
    const { result } = renderMenu();
    const emitSpy = vi.spyOn(channel, 'emit');
    send(makeState());

    const menuItem = result.current.links[1]![0] as NormalLink;
    clickLink(menuItem);
    expect(emitSpy).toHaveBeenCalledWith(
      HIGHLIGHT_MENU_CLICK,
      'h1',
      'item-1',
      makeTarget().details
    );
  });

  it('updates the open menu when the registry changes', () => {
    const { result } = renderMenu();
    send(makeState({ targets: [makeTarget({ id: 'h3', label: 'span#new' })] }));
    expect(result.current.links).toHaveLength(1);

    receive(HIGHLIGHT, [
      {
        id: 'h3',
        selectors: ['#target'],
        menu: [[{ id: 'item-3', title: 'New item' }]],
      },
    ]);
    expect(result.current.links).toHaveLength(2);
    expect(result.current.links[1]![0]!.title).toBe('New item');

    receive(RESET_HIGHLIGHT, []);
    expect(result.current.links).toHaveLength(1);
  });

  it('hides the menu when the story starts rendering', () => {
    const { result } = renderMenu();
    send(makeState());
    expect(result.current.open).toBe(true);

    receive(STORY_RENDER_PHASE_CHANGED, [{ newPhase: 'loading' }]);
    expect(result.current.open).toBe(false);
  });

  it('asks the preview to close when the popover is dismissed', () => {
    const { result } = renderMenu();
    const emitSpy = vi.spyOn(channel, 'emit');
    send(makeState());

    act(() => {
      result.current.onVisibleChange(false);
    });
    expect(emitSpy).toHaveBeenCalledWith(HIGHLIGHT_MENU_INTERACTION, {
      action: 'close',
      options: { target: 'storybook-preview-iframe' },
    });
  });

  it('removes its channel listeners on unmount', () => {
    const { unmount } = renderMenu();
    expect(channel.listenerCount(HIGHLIGHT_MENU)).toBe(1);

    unmount();
    expect(channel.listenerCount(HIGHLIGHT_MENU)).toBe(0);
    expect(channel.listenerCount(HIGHLIGHT)).toBe(0);
  });
});
