import type { Meta, StoryObj as CSF3Story } from "@storybook/react-vite";

import type { ButtonProps } from "./Button";
import { Button } from "./Button";

const meta = {
  title: "Example/MyButton",
  component: Button,
  tags: ["!test"],
  argTypes: {
    backgroundColor: { control: "color" },
  },
} satisfies Meta<typeof Button>;

export default meta;

export const Primary: CSF3Story<ButtonProps> = {
  args: { children: "Updated hlif9p" },
};

export const ClonedStoryhlif9p: CSF3Story<ButtonProps> = {
  args: {
    children: "Copied hlif9p",
  },
};
