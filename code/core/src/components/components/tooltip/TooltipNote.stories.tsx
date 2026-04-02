import { Button } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview.tsx';
import { TooltipNote } from './TooltipNote.tsx';
import { TooltipProvider } from './TooltipProvider.tsx';

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
