import preview from '../../.storybook/preview';
import * as HeaderStories from './Header.stories';
import { Page } from './Page';

const meta = preview.meta({
  title: 'Example/Page',
  render: (args) => Page(args),
});

export const LoggedIn = meta.story({
  args: {
    // More on composing args: https://storybook.js.org/docs/writing-stories/args#args-composition
    ...HeaderStories.LoggedIn.input.args,
  },
});

export const LoggedOut = meta.story({
  args: {
    ...HeaderStories.LoggedOut.input.args,
  },
});
