import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn } from 'storybook/test';

import { ControlsPanel } from './ControlsPanel.tsx';

const refId = 'my-ref';
const storyData = {
  type: 'story',
  id: `${refId}_example-button--primary`,
  refId,
  args: { label: 'Submit' },
  initialArgs: { label: 'Submit' },
  argTypes: { label: { name: 'label', control: { type: 'text' } } },
};
const serviceStoryData = {
  type: 'story',
  id: 'example-button--primary',
  args: { variant: 'primary' },
  initialArgs: { variant: 'primary' },
  argTypes: {},
  parameters: { __isArgsStory: true },
};

// Reproduces the #34553 condition: the story comes from a composed ref, so the host's
// global `previewInitialized` stays false while the ref's own flag is true.
const managerContext: any = {
  state: {
    path: storyData.id,
    previewInitialized: false,
    refs: { [refId]: { id: refId, previewInitialized: true } },
  },
  api: {
    getCurrentStoryData: fn(() => storyData).mockName('api::getCurrentStoryData'),
    getCurrentParameter: fn(() => ({})).mockName('api::getCurrentParameter'),
    getGlobals: fn(() => ({})).mockName('api::getGlobals'),
    getStoryGlobals: fn(() => ({})).mockName('api::getStoryGlobals'),
    getUserGlobals: fn(() => ({})).mockName('api::getUserGlobals'),
    updateGlobals: fn().mockName('api::updateGlobals'),
    updateStoryArgs: fn().mockName('api::updateStoryArgs'),
    resetStoryArgs: fn().mockName('api::resetStoryArgs'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    emit: fn().mockName('api::emit'),
  },
};

const serviceManagerContext: any = {
  ...managerContext,
  state: {
    ...managerContext.state,
    path: serviceStoryData.id,
  },
  api: {
    ...managerContext.api,
    getCurrentStoryData: fn(() => serviceStoryData).mockName('api::getCurrentStoryData'),
  },
};

const serviceGetDocgen = Object.assign(
  fn(() => ({
    id: 'example-button',
    name: 'Button',
    path: './Button.stories.tsx',
    jsDocTags: {},
    stories: [],
    argTypes: {
      variant: {
        name: 'variant',
        description: 'Visual style',
        type: { name: 'enum', value: ['primary', 'secondary'] },
      },
    },
    customArgTypes: {
      meta: {
        variant: {
          control: { type: 'radio' },
        },
      },
    },
  })).mockName('docgenService::getDocgen'),
  {
    subscribe: fn((_input: { id: string }, callback: (value: unknown) => void) => {
      callback(serviceGetDocgen(_input));
      return fn();
    }).mockName('docgenService::getDocgen.subscribe'),
  }
);

const docgenService: any = { queries: { getDocgen: serviceGetDocgen } };

const meta = {
  component: ControlsPanel,
  args: { saveStory: fn(), createStory: fn() },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
} satisfies Meta<typeof ControlsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Regression test for #34553: controls for a story from a composed ref must render even
 * though the host's global `previewInitialized` flag never flips. Before the fix the panel
 * read only that global flag, so it stayed in its loading state and showed skeletons forever.
 */
export const RefStoryControlsLoad: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('label')).toBeInTheDocument();
  },
};

export const ServiceDocgenControlsLoad: Story = {
  args: { docgenService },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={serviceManagerContext}>{storyFn()}</ManagerContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('variant')).toBeInTheDocument();
    await expect(serviceGetDocgen).toHaveBeenCalledWith({ id: 'example-button' });
  },
};
