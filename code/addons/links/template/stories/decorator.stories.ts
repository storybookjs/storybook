import { global as globalThis } from '@storybook/global';

import { withLinks } from '@storybook/addon-links';

export default {
  component: globalThis.Components.Html,
  parameters: {
    chromatic: { disable: true },
  },
  decorators: [withLinks],
};

export const Target = {
  args: {
    content: `
      <div>
      This is just a story to target with the links
      </div>
    `,
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const KindAndStory = {
  args: {
    content: `
      <div>
        <a class="link" href="#" data-sb-kind="addons-links-decorator" data-sb-story="story-only">go to story only</a>
      </div>
    `,
  },
};

export const StoryOnly = {
  args: {
    content: `
      <div>
        <a class="link" href="#" data-sb-story="target">go to target</a>
      </div>
    `,
  },
};

export const KindOnly = {
  args: {
    content: `
      <div>
        <a class="link" href="#" data-sb-kind="addons-links-decorator">go to target</a>
      </div>
    `,
  },
};
