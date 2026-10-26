import React from 'react';

import { Channel } from 'storybook/internal/channels';

import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

import preview from '../../../.storybook/preview.tsx';
import {
  HIGHLIGHT,
  HIGHLIGHT_MENU,
  HIGHLIGHT_MENU_CLICK,
  HIGHLIGHT_MENU_INTERACTION,
} from './constants.ts';
import { HighlightMenu } from './menu.tsx';
import type { HighlightMenuState } from './types.ts';

const FIXED_STATE: HighlightMenuState = {
  targets: [
    {
      id: 'menu-highlight',
      label: 'div#first',
      details: {
        top: 0,
        left: 0,
        width: 200,
        height: 100,
        selectors: ['#first'],
        element: { localName: 'div', tagName: 'DIV' },
      },
    },
    {
      id: 'menu-highlight',
      label: 'span#second',
      details: {
        top: 0,
        left: 0,
        width: 120,
        height: 40,
        selectors: ['#second'],
        element: { localName: 'span', tagName: 'SPAN' },
      },
    },
  ],
  selected: null,
  coords: { x: 200, y: 150 },
};

const HIGHLIGHT_DEFINITION = {
  id: 'menu-highlight',
  selectors: ['#first', '#second'],
  menu: [
    [
      {
        id: 'color-contrast',
        title: 'Insufficient color contrast',
        description: 'Elements must meet minimum color contrast ratio thresholds.',
        clickable: true,
      },
    ],
    [
      {
        id: 'links-need-discernible-text',
        title: 'Links need discernible text',
        description: 'This is where a summary of the violation goes.',
      },
      {
        id: 'links-need-discernible-text-details',
        title: 'Important stuff',
        description: 'Click here to view more details.',
        iconLeft: 'info' as const,
        iconRight: 'shareAlt' as const,
        clickable: true,
      },
    ],
  ],
};

let activeChannel: Channel | undefined;

const createMockApi = (channel: Channel) => {
  let state = FIXED_STATE;

  return {
    getChannel: () => channel,
    getRefs: () => ({}),
    emit: (type: string, data: any, ...args: any[]) => {
      if (type === HIGHLIGHT_MENU_INTERACTION) {
        if (data.action === 'select') {
          state = { ...state, selected: data.index };
        } else if (data.action === 'deselect') {
          state = { ...state, selected: null };
        } else if (data.action === 'close') {
          state = { ...state, targets: [], selected: null, coords: null };
        }
        channel.emit(HIGHLIGHT_MENU, state);
      }
      channel.emit(type, data, ...args);
    },
  } as any;
};

const ManagerMenu = () => {
  const channel = React.useMemo(() => new Channel({}), []);
  const api = React.useMemo(() => createMockApi(channel), [channel]);

  React.useEffect(() => {
    activeChannel = channel;
    const iframe = document.createElement('iframe');
    iframe.id = 'storybook-preview-iframe';
    iframe.title = 'Preview iframe';
    iframe.style.cssText = [
      'position: fixed',
      'left: 100px',
      'top: 100px',
      'width: 720px',
      'height: 480px',
      'border: 1px solid #d9e0e6',
      'background: white',
    ].join(';');
    iframe.srcdoc =
      '<body style="margin:0;font-family:sans-serif;background:#f6f9fc;color:#2e3438"><div style="padding:24px"><div id="first" style="padding:24px;border:1px dashed #029cfd">Highlighted target</div><p><span id="second">Another highlighted target</span></p></div></body>';
    document.body.appendChild(iframe);

    channel.emit(HIGHLIGHT, HIGHLIGHT_DEFINITION);
    channel.emit(HIGHLIGHT_MENU, FIXED_STATE);

    return () => {
      iframe.remove();
      if (activeChannel === channel) {
        activeChannel = undefined;
      }
    };
  }, [channel]);

  return <HighlightMenu api={api} />;
};

const meta = preview.meta({
  title: 'Highlight/Manager menu',
  parameters: { layout: 'fullscreen' },
  render: () => <ManagerMenu />,
});

export const Menu = meta.story({
  play: async () => {
    const onMenuClick = fn();
    activeChannel?.on(HIGHLIGHT_MENU_CLICK, onMenuClick);

    const secondTarget = await screen.findByText('span#second');
    await userEvent.click(secondTarget);

    const menuItem = await screen.findByText('Insufficient color contrast');
    await userEvent.click(menuItem);

    await waitFor(() =>
      expect(onMenuClick).toHaveBeenCalledWith(
        'menu-highlight',
        'color-contrast',
        expect.objectContaining({ selectors: ['#second'] })
      )
    );

    if (activeChannel) {
      activeChannel.off(HIGHLIGHT_MENU_CLICK, onMenuClick);
    }
  },
});
