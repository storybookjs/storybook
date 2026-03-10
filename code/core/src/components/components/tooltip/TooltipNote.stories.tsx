import { Button } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import { TooltipNote } from './TooltipNote';
import { TooltipProvider } from './TooltipProvider';

const ViewPort = styled.div({
  height: 300,
});

const meta = preview.meta({
  id: 'overlay-TooltipNote',
  title: 'Overlay/TooltipNote',
  component: TooltipNote,
  args: {},
  decorators: [
    (storyFn) => (
      <ViewPort>
        <TooltipProvider defaultVisible tooltip={storyFn()}>
          <Button ariaLabel={false}>Show Tooltip</Button>
        </TooltipProvider>
      </ViewPort>
    ),
  ],
});

export const Base = meta.story({
  args: {
    note: 'This is a note',
  },
});
