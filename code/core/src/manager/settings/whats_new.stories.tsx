import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, waitFor } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { WhatsNewScreen } from './whats_new.tsx';

const loadWhatsNewPost = fn().mockName('api::loadWhatsNewPost');

const managerContext: any = {
  state: { whatsNewData: { status: 'DISABLED' } },
  api: { loadWhatsNewPost },
};

const meta = preview.meta({
  component: WhatsNewScreen,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
          <Story />
        </div>
      </ManagerContext.Provider>
    ),
  ],
  beforeEach: () => {
    loadWhatsNewPost.mockReset();
  },
});

export const DisabledLoadsOnOpen = meta.story({
  beforeEach: () => {
    loadWhatsNewPost.mockReturnValue(new Promise(() => {}));
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Loading...')).toBeVisible();
    await waitFor(() => expect(loadWhatsNewPost).toHaveBeenCalledOnce());
  },
});

export const DisabledLoadFails = meta.story({
  beforeEach: () => {
    loadWhatsNewPost.mockResolvedValue(false);
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        "The page couldn't be loaded. Check your internet connection and try again."
      )
    ).toBeVisible();
    await expect(canvas.queryByText('Loading...')).not.toBeInTheDocument();
  },
});
