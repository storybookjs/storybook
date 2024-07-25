import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";
import EnvironmentVariables from "./EnvironmentVariables";

const meta = {
  component: EnvironmentVariables,
} satisfies Meta<typeof EnvironmentVariables>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId("nextConfigEnv")).toHaveTextContent(
      "next-config-env",
    );
    await expect(canvas.getByTestId("nextPrefixEnv")).toHaveTextContent(
      "example1",
    );
    // await expect(canvas.getByTestId('nonNextPrefixEnv')).toHaveTextContent('RESTRICTED_VALUE')
  },
};
