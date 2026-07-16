import type { ComponentProps } from 'react';
import React from 'react';

import { ResetWrapper } from 'storybook/internal/components';

import { TableWrapper } from './ArgsTable';
import { SectionRow } from './SectionRow';

export default {
  component: SectionRow,
  decorators: [
    (getStory: any, context: any) => (
      <div dir={context.parameters?.direction ?? 'ltr'}>
        <ResetWrapper>
          <TableWrapper>
            <tbody>{getStory()}</tbody>
          </TableWrapper>
        </ResetWrapper>
      </div>
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

// Under `dir="rtl"` the expander icon's logical margins resolve to the opposite
// physical sides so it keeps hugging the heading's inline-start; the old physical
// `marginLeft`/`marginRight` stayed put and overlapped the label (#35481).
export const SectionRtl = {
  args: { ...Section.args },
  parameters: { direction: 'rtl' },
};
