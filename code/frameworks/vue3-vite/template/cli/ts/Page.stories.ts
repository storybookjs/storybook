import type { Meta, StoryObj, WithCustomArgs } from '@storybook/vue3-vite';

import { expect, userEvent, within } from 'storybook/test';

import MyPage from './Page.vue';

// Example of using custom args that don't map to component props
type PageArgs = WithCustomArgs<typeof MyPage, { footer?: string }>;

const meta = {
  title: 'Example/Page',
  component: MyPage,
  render: (args) => ({
    components: { MyPage },
    setup() {
      return { args };
    },
    template: `
      <my-page v-bind="args">
        <template v-slot:footer>
          <footer v-if="args.footer" v-html="args.footer" />
        </template>
      </my-page>
    `,
  }),
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/configure/story-layout
    layout: 'fullscreen',
  },
  // This component will have an automatically generated docsPage entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
} satisfies Meta<PageArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCustomFooter: Story = {
  args: {
    footer: 'Built with Storybook',
  },
};

// More on component testing: https://storybook.js.org/docs/writing-tests/interaction-testing
export const LoggedIn: Story = {
  play: async ({ canvasElement }: any) => {
    const canvas = within(canvasElement);
    const loginButton = canvas.getByRole('button', { name: /Log in/i });
    await expect(loginButton).toBeInTheDocument();
    await userEvent.click(loginButton);
    await expect(loginButton).not.toBeInTheDocument();

    const logoutButton = canvas.getByRole('button', { name: /Log out/i });
    await expect(logoutButton).toBeInTheDocument();
  },
};

export const LoggedOut: Story = {};
