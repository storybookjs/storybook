import type { Meta } from '@storybook/react';
import type { StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { cookies, headers } from '@storybook/nextjs/headers.mock';
import NextHeader from './NextHeader';

export default {
  component: NextHeader,
} as Meta<typeof NextHeader>;

type Story = StoryObj<typeof NextHeader>;

export const Default: Story = {
  loaders: async () => {
    cookies().set('firstName', 'Jane');
    cookies().set({
      name: 'lastName',
      value: 'Doe',
    });
    headers().set('timezone', 'Central European Summer Time');
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const headersMock = headers();
    const cookiesMock = cookies();
    await step('Cookie and header store apis are called upon rendering', async () => {
      await expect(cookiesMock.getAll).toHaveBeenCalled();
      await expect(headersMock.entries).toHaveBeenCalled();
    });

    await step('Upon clicking on submit, the user-id cookie is set', async () => {
      const submitButton = await canvas.findByRole('button');
      await userEvent.click(submitButton);

      await expect(cookiesMock.set).toHaveBeenCalledWith('user-id', 'encrypted-id');
    });

    await step('The user-id cookie is available in cookie and header stores', async () => {
      await expect(headersMock.get('cookie')).toContain('user-id=encrypted-id');
      await expect(cookiesMock.get('user-id')).toEqual({
        name: 'user-id',
        value: 'encrypted-id',
      });
    });
  },
};
