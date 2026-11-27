import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { expect, within } from 'storybook/test';
import { styled } from 'storybook/theming/emotion';

import * as ArgRow from './ArgRow.stories';
import { ArgsTable, ArgsTableError } from './ArgsTable';

const meta = {
  component: ArgsTable,
  title: 'Components/ArgsTable/ArgsTable',
  args: {
    updateArgs: action('updateArgs'),
    resetArgs: action('resetArgs'),
  },
} satisfies Meta<typeof ArgsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const propsSection = {
  category: 'props ',
};
const eventsSection = {
  category: 'events ',
};
const componentSubsection = {
  subcategory: 'MyComponent ',
};
const htmlElementSubsection = {
  subcategory: 'HTMLElement',
};
const stringType = ArgRow.String.args.row;
const numberType = ArgRow.Number.args.row;
const longEnumType = ArgRow.LongEnum.args.row;

export const Loading = {
  args: {
    isLoading: true,
  },
};

export const Normal = {
  args: {
    rows: {
      stringType,
      numberType,
    },
  },
};

export const Compact = {
  args: { ...Normal.args, compact: true },
};

export const Rtl: Story = {
  args: Normal.args,
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: 'Reset controls' }).getBoundingClientRect();
    const control = canvas.getByRole('columnheader', { name: 'Control' }).getBoundingClientRect();
    const buttonCenter = button.left + button.width / 2;

    await expect(buttonCenter).toBeGreaterThanOrEqual(control.left);
    await expect(buttonCenter).toBeLessThanOrEqual(control.right);
  },
};

export const Sections = {
  args: {
    rows: {
      a: { ...stringType, table: { ...stringType.table, ...propsSection } },
      b: { ...numberType, table: { ...stringType.table, ...propsSection } },
      c: { ...stringType, table: { ...stringType.table, ...eventsSection } },
    },
  },
};

export const SectionsCompact = {
  args: { ...Sections.args, compact: true },
};

export const SectionsAndSubsections = {
  args: {
    rows: {
      a: { ...stringType, table: { ...stringType.table, ...propsSection, ...componentSubsection } },
      b: { ...numberType, table: { ...stringType.table, ...propsSection, ...componentSubsection } },
      c: {
        ...stringType,
        table: { ...stringType.table, ...eventsSection, ...componentSubsection },
      },
      d: {
        ...stringType,
        table: { ...stringType.table, ...eventsSection, ...htmlElementSubsection },
      },
    },
  },
};

export const SubsectionsOnly = {
  args: {
    rows: {
      a: { ...stringType, key: 'stringA', table: { ...stringType.table, ...componentSubsection } },
      b: { ...numberType, table: { ...stringType.table, ...componentSubsection } },
      c: { ...stringType, key: 'stringB', table: { ...stringType.table, ...componentSubsection } },
      d: {
        ...stringType,
        key: 'stringC',
        table: { ...stringType.table, ...htmlElementSubsection },
      },
    },
  },
};

export const AllControls = {
  args: {
    rows: {
      array: ArgRow.ArrayOf.args.row,
      boolean: ArgRow.Boolean.args.row,
      color: ArgRow.Color.args.row,
      date: ArgRow.Date.args.row,
      string: ArgRow.String.args.row,
      number: { ...ArgRow.Number.args.row, key: 'number' },
      range: { ...ArgRow.Number.args.row, key: 'range' },
      radio: { ...ArgRow.Radio.args.row, key: 'radio' },
      inlineRadio: { ...ArgRow.InlineRadio.args.row, key: 'inlineRadio' },
      check: { ...ArgRow.Check.args.row, key: 'check' },
      inlineCheck: { ...ArgRow.InlineCheck.args.row, key: 'inlineCheck' },
      select: { ...ArgRow.Select.args.row, key: 'select' },
      multiSelect: { ...ArgRow.MultiSelect.args.row, key: 'multiSelect' },
      object: ArgRow.ObjectOf.args.row,
      func: ArgRow.Func.args.row,
    },
  },
};

/** Setting an empty Object control opens its raw editor with the caret inside the brackets. */
export const AllControlsObjectSet: Story = {
  args: AllControls.args,
  play: async ({ canvas, canvasElement, userEvent }) => {
    // Several rows have a "Set object" button, so the one of interest is looked up by its id.
    await userEvent.click(canvasElement.querySelector('#set-someObject')!);

    const rawInput = canvas.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Edit someObject as JSON',
    });
    await expect(rawInput).toHaveValue('{}');
    await expect(rawInput).toHaveFocus();
    await expect([rawInput.selectionStart, rawInput.selectionEnd]).toEqual([1, 1]);
  },
};

export const AllControlsFilled: Story = {
  args: {
    ...AllControls.args,
    args: {
      someArray: [1, 2, 3],
      someBoolean: true,
      someColor: '#ff4785',
      someDate: new Date('2020-10-20T09:30:02'),
      someObject: {
        name: 'Storybook',
        nested: { enabled: true, count: 2 },
      },
      someString: 'Filled string control',
      number: 42,
      range: 24,
      radio: 'b',
      inlineRadio: 'c',
      check: ['a'],
      inlineCheck: ['b', 'c'],
      select: 'b',
      multiSelect: ['a', 'c'],
    },
  },
};

const AddonPanelLayout = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  background: theme.background.content,
}));

export const InAddonPanel = {
  args: {
    ...Normal.args,
    inAddonPanel: true,
    rows: SectionsAndSubsections.args.rows,
  },
  decorators: [(storyFn: any) => <AddonPanelLayout>{storyFn()}</AddonPanelLayout>],
  parameters: {
    layout: 'fullscreen',
  },
};

export const InAddonPanelNoControls = {
  ...InAddonPanel,
  args: {
    ...InAddonPanel.args,
    rows: Object.fromEntries(
      Object.entries(InAddonPanel.args.rows).map(([k, v]) => [k, { ...v, control: null as any }])
    ),
  },
};

export const Error = {
  args: {
    error: ArgsTableError.NO_COMPONENT,
  },
};

const expectEmptyState = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);

  await expect(await canvas.findByText('This story has no controls')).toBeVisible();
  await expect(
    await canvas.findByText(/Storybook couldn't find or generate any controls for this story/i)
  ).toBeVisible();
  const learnMoreLink = await canvas.findByRole('link', {
    name: /Read docs/i,
  });

  await expect(learnMoreLink).toBeVisible();
  await expect(learnMoreLink).toHaveAttribute(
    'href',
    'https://storybook.js.org/docs/essentials/controls?ref=ui'
  );
};

export const Empty: Story = {
  args: {
    rows: {},
  },
  parameters: {
    layout: 'centered',
  },
  play: async ({ canvasElement }) => {
    await expectEmptyState(canvasElement);
  },
};

export const EmptyInsideAddonPanel: Story = {
  args: {
    isLoading: false,
    inAddonPanel: true,
  },
  parameters: {
    layout: 'centered',
  },
  play: async ({ canvasElement }) => {
    await expectEmptyState(canvasElement);
  },
};

export const WithDefaultExpandedArgs = {
  args: {
    rows: {
      longEnumType,
    },
    initialExpandedArgs: true,
  },
};
