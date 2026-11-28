import { withActions } from 'storybook/actions/decorator';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  args: {
    label: 'Click Me!',
  },
  argTypes: {
    // Frameworks that infer argTypes from component metadata (Angular compodoc) mark the button's
    // click output as an implicit action. Together with the withActions DOM handle below, every
    // click would then be logged twice (once as 'clicked', once as 'onClick'). Neutralize the
    // inferred action so exactly one action per click is logged on every renderer. The explicit
    // null overrides the inferred `action` through argTypes deep-merging.
    onClick: { action: null },
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Basic = {
  parameters: {
    actions: {
      handles: [{ click: 'clicked', contextmenu: 'right clicked' }],
    },
  },
  decorators: [withActions],
};
