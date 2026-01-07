import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import type { ViewportMap } from 'storybook/viewport';

import preview from '../../../../../.storybook/preview';
import { Viewport } from './Viewport';

const managerContext: any = {
  state: {},
  api: {
    getCurrentParameter: fn(),
    getGlobals: fn(() => ({})),
    getStoryGlobals: fn(() => ({})),
    getUserGlobals: fn(() => ({})),
    updateGlobals: fn(),
    setAddonShortcut: fn(),
    on: fn(),
    off: fn(),
    emit: fn(),
  },
};

const customViewports = {
  narrow: {
    name: 'Narrow',
    styles: {
      height: '100%',
      width: '400px',
    },
    type: 'other',
  },
  short: {
    name: 'Short',
    styles: {
      height: '400px',
      width: '100%',
    },
    type: 'other',
  },
} as ViewportMap;

const meta = preview.meta({
  component: Viewport,
  args: {
    active: true,
    id: 'storybook-preview-iframe',
    src: '/iframe.html?id=manager-settings-checklist--default',
    scale: 1,
  },
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <Story />
      </ManagerContext.Provider>
    ),
  ],
  globals: {
    viewport: { value: undefined },
  },
  parameters: {
    layout: 'centered',
  },
  beforeEach: () => {
    managerContext.api.getCurrentParameter.mockReset();
    managerContext.api.getGlobals.mockReset();
    managerContext.api.getStoryGlobals.mockReset();
    managerContext.api.getUserGlobals.mockReset();
  },
});

export const Default = meta.story({
  parameters: {
    layout: 'fullscreen',
  },
});

export const Mobile = meta.story({
  beforeEach() {
    managerContext.api.getGlobals.mockReturnValue({ viewport: { value: 'mobile1' } });
  },
});

export const Locked = meta.story({
  beforeEach() {
    managerContext.api.getGlobals.mockReturnValue({
      viewport: { value: 'mobile1' },
    });
    managerContext.api.getStoryGlobals.mockReturnValue({
      viewport: { value: 'mobile1' },
    });
  },
});

export const Rotated = meta.story({
  beforeEach() {
    managerContext.api.getGlobals.mockReturnValue({
      viewport: { value: 'mobile1', isRotated: true },
    });
  },
});

export const Short = meta.story({
  globals: {
    viewport: { value: 'short' },
  },
  parameters: {
    viewport: { options: customViewports },
  },
  render: () => <></>,
});

export const Narrow = meta.story({
  globals: {
    viewport: { value: 'narrow' },
  },
  parameters: {
    viewport: { options: customViewports },
  },
  render: () => <></>,
});
