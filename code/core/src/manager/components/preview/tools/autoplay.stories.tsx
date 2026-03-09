import React from 'react';

import type { StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import { AutoplayTool } from './autoplay';

const managerContext = {
  state: {
    globals: { storyAutoplay: 'no-reduced-motion' },
    storyGlobals: {},
    userGlobals: { storyAutoplay: 'no-reduced-motion' },
  },
  api: {
    emit: fn().mockName('api::emit'),
    getGlobals: () => ({ storyAutoplay: 'no-reduced-motion' }),
    getUserGlobals: () => ({ storyAutoplay: 'no-reduced-motion' }),
    getStoryGlobals: () => ({}),
    updateGlobals: fn().mockName('api::updateGlobals'),
    getCurrentParameter: () => undefined,
  },
} as any;

const ManagerDecorator = (Story: any) => (
  <ManagerContext.Provider value={managerContext}>
    <div style={{ padding: 24 }}>{Story()}</div>
  </ManagerContext.Provider>
);

const meta = {
  title: 'Manager/Preview/Tools/Autoplay',
  component: AutoplayTool,
  decorators: [ManagerDecorator],
  parameters: { layout: 'centered' },
  tags: ['!vitest'],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AlwaysAutoplay: Story = {
  decorators: [
    (Story: any) => (
      <ManagerContext.Provider
        value={
          {
            ...managerContext,
            state: {
              ...managerContext.state,
              globals: { storyAutoplay: 'always' },
              userGlobals: { storyAutoplay: 'always' },
            },
            api: {
              ...managerContext.api,
              getGlobals: () => ({ storyAutoplay: 'always' }),
              getUserGlobals: () => ({ storyAutoplay: 'always' }),
            },
          } as any
        }
      >
        <div style={{ padding: 24 }}>{Story()}</div>
      </ManagerContext.Provider>
    ),
  ],
};

export const NeverAutoplay: Story = {
  decorators: [
    (Story: any) => (
      <ManagerContext.Provider
        value={
          {
            ...managerContext,
            state: {
              ...managerContext.state,
              globals: { storyAutoplay: 'never' },
              userGlobals: { storyAutoplay: 'never' },
            },
            api: {
              ...managerContext.api,
              getGlobals: () => ({ storyAutoplay: 'never' }),
              getUserGlobals: () => ({ storyAutoplay: 'never' }),
            },
          } as any
        }
      >
        <div style={{ padding: 24 }}>{Story()}</div>
      </ManagerContext.Provider>
    ),
  ],
};

export const LockedByStory: Story = {
  decorators: [
    (Story: any) => (
      <ManagerContext.Provider
        value={
          {
            ...managerContext,
            state: {
              ...managerContext.state,
              globals: { storyAutoplay: 'always' },
              storyGlobals: { storyAutoplay: 'always' },
              userGlobals: { storyAutoplay: 'never' },
            },
            api: {
              ...managerContext.api,
              getGlobals: () => ({ storyAutoplay: 'always' }),
              getUserGlobals: () => ({ storyAutoplay: 'never' }),
              getStoryGlobals: () => ({ storyAutoplay: 'always' }),
            },
          } as any
        }
      >
        <div style={{ padding: 24 }}>{Story()}</div>
      </ManagerContext.Provider>
    ),
  ],
};

export const WithGlobals: Story = {
  globals: {
    storyAutoplay: 'always',
  },
};
