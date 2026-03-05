import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

// https://github.com/storybookjs/storybook/issues/30237
export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...context.args } } }),
  ],
  argTypes: {
    icon: {
      control: 'text',
      table: {
        type: {
          summary: 'IconName',
          detail: [
            "'filter'",
            "'search'",
            "'close'",
            "'info'",
            "'alertCircle'",
            "'alertTriangle'",
            "'archive'",
            "'arrowLeftToLine'",
            "'arrowRightToLine'",
            "'attachment'",
            "'back'",
            "'bookmark'",
            "'bulletPoint'",
            "'calendar'",
            "'call'",
            "'cart'",
            "'chat'",
            "'check'",
            "'checkDocument'",
            "'chevronDown'",
            "'chevronLeft'",
            "'chevronRight'",
            "'chevronUp'",
            "'contextMenu'",
            "'dashboard'",
            "'download'",
            "'draggable'",
            "'duplicate'",
            "'edit'",
            "'expand'",
            "'eye'",
            "'file'",
            "'fullscreen'",
            "'globe'",
            "'home'",
            "'infoCircle'",
            "'list'",
            "'locationPin'",
            "'lock'",
            "'logout'",
            "'mail'",
            "'menu'",
            "'minus'",
            "'plus'",
            "'print'",
            "'save'",
            "'settings'",
            "'star'",
            "'trash'",
            "'upload'",
            "'user'",
            "'zoomIn'",
            "'zoomOut'",
          ].join('\n| '),
        },
      },
    },
  },
  args: {
    icon: 'filter',
  },
  parameters: {
    controls: { expanded: true },
  },
};

export const PopoverOverflow = {};
