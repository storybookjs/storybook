import React, { useState } from 'react';

import { TabsView } from 'storybook/internal/components';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import * as ArgRow from './ArgRow.stories';
import { ArgsTable } from './ArgsTable';
import { Compact, Normal, Sections } from './ArgsTable.stories';
import type { TabbedArgsTableProps } from './TabbedArgsTable';
import { TabbedArgsTable } from './TabbedArgsTable';
import type { Args } from './types';

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

/**
 * When multiple tabs are shown, editing a control on the first tab should not remount the input and
 * drop focus. This verifies the fix for https://github.com/storybookjs/storybook/issues/29028
 */
export const RetainControlFocusWithTabs: StoryObj<typeof meta> = {
  args: {
    tabs: {
      Main: {
        rows: {
          someString: ArgRow.String.args.row,
        },
      },
      Other: {
        rows: {
          numberType: ArgRow.Number.args.row,
        },
      },
    },
    args: { someString: 'hello' },
  },
  render: function Render(props) {
    const [storyArgs, setStoryArgs] = useState<Args>({ someString: 'hello' });
    return (
      <TabbedArgsTable
        {...(props as TabbedArgsTableProps)}
        args={storyArgs}
        updateArgs={(updated) => setStoryArgs((prev) => ({ ...prev, ...updated }))}
      />
    );
  },
  beforeEach: async ({ canvasElement }) => {
    return async () => {
      const canvas = within(canvasElement);
      const input = canvas.queryByDisplayValue('hellox') ?? canvas.queryByDisplayValue('hello');
      if (!input) {
        return;
      }
      await userEvent.clear(input);
      await userEvent.type(input, 'hello');
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('hello');
    await userEvent.click(input);
    await userEvent.type(input, 'x');
    await expect(document.activeElement).toBe(input);
  },
};
