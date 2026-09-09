import type { PlayFunction, PlayFunctionContext } from 'storybook/internal/types';

import { ManagerContext } from 'storybook/manager-api';
import { expect, fn, screen } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { VisionSimulator } from './VisionSimulator.tsx';

const managerContext: any = {
  state: {},
  api: {
    on: fn(),
    off: fn(),
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
    (Story: any, context) => (
      <ManagerContext.Provider
        value={{
          ...managerContext,
          api: {
            ...managerContext.api,
            getCurrentParameter: (key: string) => context.parameters[key],
          },
        }}
      >
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
  play: openMenu,
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

export const Disabled = meta.story({
  parameters: {
    visionSimulator: {
      disable: true,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Vision filter' })).not.toBeInTheDocument();
  },
});
