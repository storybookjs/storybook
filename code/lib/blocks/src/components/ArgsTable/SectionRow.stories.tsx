import type { ComponentProps } from 'react';
import React from 'react';

import { ResetWrapper } from 'storybook/internal/components';

import { TableWrapper } from './ArgsTable';
import { SectionRow } from './SectionRow';

export default {
  component: SectionRow,
  decorators: [
    (getStory: any) => (
      <ResetWrapper>
        <TableWrapper>
          <tbody>{getStory()}</tbody>
        </TableWrapper>
      </ResetWrapper>
    ),
  ],
};

export const Section = {
  args: {
    level: 'section',
    label: 'Props',
  },
};

export const Subsection = {
  args: {
    level: 'subsection',
    label: 'HTMLElement',
  },
};

export const Collapsed = {
  args: { ...Section.args, initialExpanded: false },
};

export const Nested = {
  render: () => (
    <SectionRow {...(Section.args as ComponentProps<typeof SectionRow>)}>
      <SectionRow {...(Subsection.args as ComponentProps<typeof SectionRow>)}>
        <tr>
          <td colSpan={2}>Some content</td>
        </tr>
      </SectionRow>
    </SectionRow>
  ),
};
