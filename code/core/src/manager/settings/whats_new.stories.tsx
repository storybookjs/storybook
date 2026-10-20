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
    loadWhatsNewPost.mockClear();
  },
});

export const DisabledLoadsOnOpen = meta.story({
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Loading...')).toBeVisible();
    await waitFor(() => expect(loadWhatsNewPost).toHaveBeenCalledOnce());
  },
});
