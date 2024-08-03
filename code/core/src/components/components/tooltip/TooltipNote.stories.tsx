import React from 'react';
import { WithTooltip } from './WithTooltip';
import { TooltipNote } from './TooltipNote';

export default {
  component: TooltipNote,
  decorators: [
    (storyFn: any) => (
      <div
        style={{
          height: '300px',
        }}
      >
        <WithTooltip hasChrome={false} placement="top" startOpen tooltip={storyFn()}>
          <div>Tooltip</div>
        </WithTooltip>
      </div>
    ),
  ],
};

export const Default = {
  args: {
    note: 'This is a note',
  },
};
