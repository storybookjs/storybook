import { hrefToSync } from '@storybook/addon-links';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  title: 'hrefToSync',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  args: {
    content: '<div><code id="content">Generating link...</code></div>',
  },
};

export const Default = {
  play: () => {
    const href = hrefToSync('addons-links-hreftosync', 'target');
    const content = document.querySelector('#content');
    if (content) {
      content.textContent = href;
    }
  },
};
