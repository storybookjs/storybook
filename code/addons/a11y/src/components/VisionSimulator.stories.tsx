import type { PlayFunction } from 'storybook/internal/types';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { VisionSimulator } from './VisionSimulator.tsx';

const managerContext: any = {
  state: {},
  api: {
    getGlobals: fn(() => ({ vision: undefined })),
    updateGlobals: fn(),
    getStoryGlobals: fn(() => ({ vision: undefined })),
    getUserGlobals: fn(() => ({ vision: undefined })),
  },
};

const meta = preview.meta({
  title: 'Vision Simulator',
  component: VisionSimulator,
  decorators: [
    (Story: any) => (
      <ManagerContext.Provider value={managerContext}>
        <Story />
      </ManagerContext.Provider>
    ),
  ],
});

export default meta;

const openMenu: PlayFunction = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Vision filter' }));
};

export const Default = meta.story({
  play: async (context) => {
    await openMenu(context);
    await expect(await screen.findByText(/3\.26% of users/)).toBeVisible();
    await expect(await screen.findByText(/Brettel et al\. 1997/)).toBeVisible();
  },
});

export const WithFilter = meta.story({
  play: openMenu,
  globals: {
    vision: 'achromatopsia',
  },
});

export const Selection = meta.story({
  play: async (context) => {
    await openMenu(context);
    await context.userEvent.click(await screen.findByText('Blurred vision'));
    await expect(managerContext.api.updateGlobals).toHaveBeenCalledWith({ vision: 'blurred' });
    await expect(
      context.canvas.getByRole('button', { name: 'Vision filter Blurred vision' })
    ).toBeVisible();
  },
});
