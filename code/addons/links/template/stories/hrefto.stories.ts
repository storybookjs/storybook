import { hrefTo } from '@storybook/addon-links';

export default {
  component: globalThis.Components.Html,
  title: 'hrefTo',
  parameters: {
    chromatic: { disable: true },
  },
  args: {
    content: '<div><code id="content">Waiting for hrefTo to resolve...</code></div>',
  },
};

export const Default = {
  play: async () => {
    const href = await hrefTo('addons-links-hrefto', 'target');
    const content = document.querySelector('#content');
    if (content) {
      content.textContent = href;
    }
  },
};
