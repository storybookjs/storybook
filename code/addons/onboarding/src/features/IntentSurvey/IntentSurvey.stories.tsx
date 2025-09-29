import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

import { IntentSurvey } from './IntentSurvey';

const meta = {
  component: IntentSurvey,
  args: {
    onComplete: fn(),
    onDismiss: fn(),
  },
} as Meta<typeof IntentSurvey>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {};

export const Submitting: Story = {
  play: async ({ args }) => {
    const button = await screen.findByRole('button', { name: 'Submit' });
    await expect(button).toBeDisabled();

    await userEvent.click(await screen.findByText('Design system'));
    await expect(button).toBeDisabled();

    await userEvent.click(await screen.findByText('Functional testing'));
    await userEvent.click(await screen.findByText('Accessibility testing'));
    await userEvent.click(await screen.findByText('Visual testing'));
    await expect(button).toBeDisabled();

    await userEvent.selectOptions(screen.getByRole('combobox'), ['We use it at work']);
    await expect(button).not.toBeDisabled();

    await userEvent.click(button);

    await waitFor(async () => {
      await expect(button).toBeDisabled();
      await expect(args.onComplete).toHaveBeenCalledWith({
        building: {
          'application-ui': false,
          'design-system': true,
        },
        interest: {
          'accessibility-testing': true,
          'ai-augmented-development': false,
          'design-handoff': false,
          'functional-testing': true,
          'team-collaboration': false,
          'ui-documentation': false,
          'visual-testing': true,
        },
        referrer: {
          'ai-agent': false,
          'via-friend-or-colleague': false,
          'via-social-media': false,
          'we-use-it-at-work': true,
          'web-search': false,
          youtube: false,
        },
      });
    });
  },
};
