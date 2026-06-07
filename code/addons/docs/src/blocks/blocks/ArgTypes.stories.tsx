import React from "react";

import type { PlayFunctionContext } from "storybook/internal/csf";

import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, within } from "storybook/test";

import * as ExampleStories from "../examples/ArgTypesParameters.stories";
import * as SubcomponentsExampleStories from "../examples/ArgTypesWithSubcomponentsParameters.stories";
import { DocgenServiceArgTypes, LegacyArgTypes } from "./ArgTypes";

type ArgTypesStoryProps = React.ComponentProps<typeof LegacyArgTypes>;

const panelHeadingStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  margin: "0 0 12px",
};

const comparisonGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  width: "100%",
};

const comparisonPanelStyle: React.CSSProperties = {
  minWidth: 0,
};

function ArgTypesComparison(props: ArgTypesStoryProps) {
  return (
    <div style={comparisonGridStyle}>
      <section aria-label="Legacy arg types" style={comparisonPanelStyle}>
        <h3 style={panelHeadingStyle}>Legacy</h3>
        <LegacyArgTypes {...props} />
      </section>
      <section
        aria-label="Docgen service arg types"
        style={comparisonPanelStyle}
      >
        <h3 style={panelHeadingStyle}>Docgen service</h3>
        <DocgenServiceArgTypes {...props} />
      </section>
    </div>
  );
}

type StoryCanvas = ReturnType<typeof within>;

async function expectArgTypeRowInBothPanels(
  canvas: StoryCanvas,
  rowName: string,
) {
  await expect(
    await canvas.getByLabelText("Legacy arg types").findByText(rowName),
  ).toBeInTheDocument();
  await expect(
    await canvas.getByLabelText("Docgen service arg types").findByText(rowName),
  ).toBeInTheDocument();
}

const meta = {
  title: "Blocks/ArgTypes",
  component: LegacyArgTypes,
  render: (args) => <ArgTypesComparison {...args} />,
  parameters: {
    layout: "fullscreen",
    relativeCsfPaths: [
      "../examples/ArgTypesParameters.stories",
      "../examples/ArgTypesWithSubcomponentsParameters.stories",
    ],
    docsStyles: true,
  },
} satisfies Meta<typeof LegacyArgTypes>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expectArgTypeRowInBothPanels(canvas, "b");
  },
};

export const OfComponent: Story = {
  args: {
    of: ExampleStories.default.component,
  },
};

export const OfMeta: Story = {
  args: {
    of: ExampleStories.default,
  },
};

export const OfStory: Story = {
  args: {
    of: ExampleStories.NoParameters,
  },
};

export const OfUndefined: Story = {
  args: {
    // @ts-expect-error this is supposed to be undefined
    of: ExampleStories.NotDefined,
  },
  parameters: { chromatic: { disableSnapshot: true } },
  tags: ["!test"],
};

export const OfStoryUnattached: Story = {
  parameters: { attached: false },
  args: {
    of: ExampleStories.NoParameters,
  },
};

export const IncludeProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    include: ["a"],
  },
};

export const IncludeParameter: Story = {
  args: {
    of: ExampleStories.Include,
  },
};

export const ExcludeProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    exclude: ["a"],
  },
};

export const ExcludeParameter: Story = {
  args: {
    of: ExampleStories.Exclude,
  },
};

export const SortProp: Story = {
  args: {
    of: ExampleStories.NoParameters,
    sort: "alpha",
  },
};

export const SortParameter: Story = {
  args: {
    of: ExampleStories.Sort,
  },
};

export const Categories: Story = {
  args: {
    of: ExampleStories.Categories,
  },
};

const findSubcomponentTabs = async (
  canvas: StoryCanvas,
  step: PlayFunctionContext["step"],
  panelName: "legacy" | "docgen",
) => {
  let subcomponentATab: HTMLElement | null = null;
  let subcomponentBTab: HTMLElement | null = null;
  await step(
    `should have tabs for the subcomponents in the ${panelName} panel`,
    async () => {
      subcomponentATab = await canvas.findByText("SubcomponentA");
      subcomponentBTab = await canvas.findByText("SubcomponentB");
    },
  );
  return { subcomponentATab, subcomponentBTab };
};

const findSubcomponentTabsInBothPanels = async (
  canvas: StoryCanvas,
  step: PlayFunctionContext["step"],
) => {
  const { legacy, docgen } = comparisonCanvases(canvas);

  return {
    legacy: await findSubcomponentTabs(legacy, step, "legacy"),
    docgen: await findSubcomponentTabs(docgen, step, "docgen"),
  };
};

export const SubcomponentsOfMeta: Story = {
  args: {
    of: SubcomponentsExampleStories.default,
  },
  play: async ({ canvas, step }) => {
    await findSubcomponentTabsInBothPanels(canvas, step);
  },
};

export const SubcomponentsOfStory: Story = {
  ...SubcomponentsOfMeta,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
  },
};

export const SubcomponentsIncludeProp: Story = {
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    include: ["a", "f"],
  },
  play: async ({ canvas, step }) => {
    const { legacy, docgen } = await findSubcomponentTabsInBothPanels(
      canvas,
      step,
    );

    for (const { subcomponentBTab } of [legacy, docgen]) {
      if (subcomponentBTab) {
        await (
          subcomponentBTab as HTMLElement & { click: () => Promise<void> }
        ).click();
      }
    }
  },
};

export const SubcomponentsExcludeProp: Story = {
  ...SubcomponentsIncludeProp,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    exclude: ["a", "c", "f", "g"],
  },
};

export const SubcomponentsSortProp: Story = {
  ...SubcomponentsIncludeProp,
  args: {
    of: SubcomponentsExampleStories.NoParameters,
    sort: "alpha",
  },
};
