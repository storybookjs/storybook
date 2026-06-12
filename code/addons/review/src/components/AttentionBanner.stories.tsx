import { expect, fn, userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { AttentionBanner } from './AttentionBanner.tsx';

const onAccept = fn();

const meta = preview.meta({
  component: AttentionBanner,
  parameters: { layout: 'fullscreen' },
  beforeEach: () => {
    onAccept.mockReset();
  },
});

export const Stale = meta.story({
  args: { kind: 'stale' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('This review may be stale. Ask your agent to refresh it.')
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Copy prompt to refresh this review' })
    ).toBeInTheDocument();
  },
});

export const PendingUpdate = meta.story({
  args: { kind: 'pending-update', onAccept },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('An updated review is available.')).toBeInTheDocument();

    await userEvent.click(await canvas.findByRole('button', { name: 'Switch' }));
    await expect(onAccept).toHaveBeenCalledOnce();
  },
});
