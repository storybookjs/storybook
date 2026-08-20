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

export const Sentence = meta.story({
  args: {
    note: 'LocalComponent is declared in the story file, so the snippet references it without importing it.',
  },
});
