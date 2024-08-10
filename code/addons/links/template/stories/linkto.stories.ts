import { global as globalThis } from '@storybook/global';

import { linkTo } from '@storybook/addon-links';

export default {
  component: globalThis.Components.Button,
  title: 'linkTo',
  args: {
    label: 'Click Me!',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Target = {
  args: {
    label: 'This is just a story to target with the links',
  },
  parameters: {
    chromatic: { disable: true },
  },
};

export const Id = {
  args: {
    onClick: linkTo('addons-links-linkto--target'),
    label: 'addons-links-linkto--target',
  },
};

export const TitleOnly = {
  args: {
    onClick: linkTo('addons/links/linkTo'),
    label: 'addons/links/linkTo',
  },
};

export const NormalizedTitleOnly = {
  args: {
    onClick: linkTo('addons-links-linkto'),
    label: 'addons-links-linkto',
  },
};

export const TitleAndName = {
  args: {
    onClick: linkTo('addons/links/linkTo', 'Target'),
    label: 'addons/links/linkTo, Target',
  },
};

export const NormalizedTitleAndName = {
  args: {
    onClick: linkTo('addons-links-linkto', 'target'),
    label: 'addons-links-linkto, target',
  },
};

export const Callback = {
  args: {
    onClick: linkTo(
      (event: Event) => 'addons-links-linkto',
      (event: Event) => 'target'
    ),
  },
};

export const ToMDXDocs = {
  args: {
    onClick: linkTo('Configure Your Project'),
    label: 'Configure Your Project',
  },
};

export const ToAutodocs = {
  args: {
    onClick: linkTo('Example Button', 'Docs'),
    label: 'Example Button, Docs',
  },
};
