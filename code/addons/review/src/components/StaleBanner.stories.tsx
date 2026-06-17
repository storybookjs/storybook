import { expect, fn, screen, userEvent, within } from 'storybook/test';

import preview from '../../../../.storybook/preview.tsx';
import { StaleBanner } from './StaleBanner.tsx';

const REFRESH_PROMPT =
  'Generate a fresh review including my latest changes using the display-review tool.';

const meta = preview.meta({
  component: StaleBanner,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 120 }}>
        <Story />
      </div>
    ),
  ],
});

const refreshTrigger = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole('button', { name: /Ask your agent to refresh it/i });

const copyPromptButton = () =>
  screen.getByRole('button', { name: /Copy prompt to refresh this review/i });

export const Default = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole('status');

    await expect(banner).toHaveTextContent('Code changes detected. This review may be stale.');
    await expect(refreshTrigger(canvas)).toBeVisible();
  },
});

export const OpenPopover = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(refreshTrigger(canvas));

    await expect(
      screen.getByText('Prompt for your agent to refresh this review:')
    ).toBeInTheDocument();
    await expect(screen.getByText(REFRESH_PROMPT)).toBeInTheDocument();
    await expect(copyPromptButton()).toBeInTheDocument();
  },
});

export const CopyPrompt = meta.story({
  beforeEach: () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(refreshTrigger(canvas));
    await userEvent.click(copyPromptButton());

    await expect(
      screen.getByRole('button', { name: /Prompt copied to clipboard/i })
    ).toBeInTheDocument();
  },
});
