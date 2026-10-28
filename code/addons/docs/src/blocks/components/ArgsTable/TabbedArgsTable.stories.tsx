import React, { useState } from 'react';

import { ArgsTable, TabsView } from 'storybook/internal/components';
import type { Args } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, within } from 'storybook/test';

import {
  COMPACT_ARGS,
  NORMAL_ARGS,
  NUMBER_ROW,
  SECTIONS_ARGS,
  STRING_ROW,
} from './argsTableFixtures.ts';
import type { TabbedArgsTableProps } from './TabbedArgsTable';
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
      Normal: NORMAL_ARGS,
      Compact: COMPACT_ARGS,
      Sections: SECTIONS_ARGS,
    },
  },
};

export const TabsInAddonPanel: StoryObj<typeof meta> = {
  args: {
    tabs: {
      Normal: NORMAL_ARGS,
      Compact: COMPACT_ARGS,
      Sections: SECTIONS_ARGS,
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
      Normal: NORMAL_ARGS,
      Compact: COMPACT_ARGS,
      Sections: SECTIONS_ARGS,
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
          someString: STRING_ROW,
        },
      },
      Other: {
        rows: {
          numberType: NUMBER_ROW,
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
