import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor } from "@storybook/test";
import dynamic from "next/dynamic";

const DynamicComponent = dynamic(() => import("./DynamicImport"));
const DynamicComponentNoSSR = dynamic(() => import("./DynamicImport"), {
  ssr: false,
});

function Component() {
  return <DynamicComponent />;
}

const meta = {
  component: Component,
} satisfies Meta<typeof DynamicComponent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText("I am a dynamically loaded component"),
      ).toBeDefined(),
    );
  },
};

export const NoSSR: Story = {
  render: () => <DynamicComponentNoSSR />,
};
