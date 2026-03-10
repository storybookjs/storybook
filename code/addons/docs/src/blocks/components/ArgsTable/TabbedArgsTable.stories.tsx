import { TabsView } from 'storybook/internal/components';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ArgsTable } from './ArgsTable';
import { Compact, Normal, Sections } from './ArgsTable.stories';
import { TabbedArgsTable } from './TabbedArgsTable';

const meta = {
  component: TabbedArgsTable,
  tags: ['autodocs'],
  subcomponents: { TabbedArgsTable: TabbedArgsTable, ArgsTable, TabsView },
} satisfies Meta<typeof TabbedArgsTable>;

export default meta;

export const Tabs: StoryObj<typeof meta> = {
  args: {
    tabs: {
      Normal: Normal.args,
      Compact: Compact.args,
      Sections: Sections.args,
    },
  },
};

export const TabsInAddonPanel: StoryObj<typeof meta> = {
  args: {
    tabs: {
      Normal: Normal.args,
      Compact: Compact.args,
      Sections: Sections.args,
    },
    inAddonPanel: true,
  },
};

export const Empty: StoryObj<typeof meta> = {
  args: {
    tabs: {},
  },
};

export const WithContentAround: StoryObj<typeof meta> = {
  args: {
    tabs: {
      Normal: Normal.args,
      Compact: Compact.args,
      Sections: Sections.args,
    },
  },
  render: (args) => (
    <>
      <p>This is some content above the TabbedArgsTable.</p>
      <TabbedArgsTable {...args} />
      <p>This is some content below the TabbedArgsTable.</p>
    </>
  ),
};
