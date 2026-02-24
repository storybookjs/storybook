import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import dynamic from "next/dynamic";
import { expect, waitFor } from "storybook/test";

const DynamicComponent = dynamic(() => import("./DynamicImport"));
const DynamicComponentNoSSR = dynamic(() => import("./DynamicImport"), {
  ssr: false,
});

// Test case that matches the user's issue pattern: using .then((mod) => mod.Component) with ssr: false
const namedExportLoader = () =>
  import("./NamedExport").then((mod) => mod.NamedComponent);
const DynamicNamedComponentNoSSR = dynamic(namedExportLoader, { ssr: false });

// Test without ssr: false to check if issue is SSR-specific
const DynamicNamedComponent = dynamic(() =>
  import("./NamedExport").then((mod) => mod.NamedComponent),
);

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
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText("I am a dynamically loaded component"),
      ).toBeDefined(),
    );
  },
};

// Test without ssr: false
export const NamedExport: Story = {
  render: () => <DynamicNamedComponent />,
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText("I am a named export dynamically loaded component"),
      ).toBeDefined(),
    );
  },
};

// This test case matches the user's issue pattern
export const NamedExportNoSSR: Story = {
  render: () => <DynamicNamedComponentNoSSR />,
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByText("I am a named export dynamically loaded component"),
      ).toBeDefined(),
    );
  },
};
