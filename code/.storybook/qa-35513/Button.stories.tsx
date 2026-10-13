import { global as globalThis } from '@storybook/global';

import { linkTo } from '@storybook/addon-links';

export default {
  title: 'Guides/Button',
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
};

export const Primary = { args: { label: 'Primary' } };

export const LinkToWelcome = {
  args: { label: "linkTo('Welcome')", onClick: linkTo('Welcome') },
};

export const LinkToIntro = {
  args: { label: "linkTo('Guides/Intro')", onClick: linkTo('Guides/Intro') },
};

export const LinkToFaq = {
  args: { label: "linkTo('Guides/FAQ')", onClick: linkTo('Guides/FAQ') },
};

export const LinkToIntroDocsByName = {
  args: { label: "linkTo('Guides/Intro', 'Docs')", onClick: linkTo('Guides/Intro', 'Docs') },
};
