import { global as globalThis } from '@storybook/global';

const style = {
  display: 'block',
  border: '2px solid #FF4785',
  padding: 10,
};

export default {
  component: globalThis.Components.Pre,
  args: {
    style,
  },
  parameters: {
    layout: 'centered',
  },
};

export const PaddedBlock = {
  args: { text: 'padded' },
  parameters: { layout: 'padded' },
};

export const PaddedInline = {
  args: { text: 'padded', style: { ...style, display: 'inline-block' } },
  parameters: { layout: 'padded' },
};

export const FullscreenBlock = {
  args: { text: 'fullscreen' },
  parameters: { layout: 'fullscreen' },
};

export const FullscreenInline = {
  args: { text: 'fullscreen', style: { ...style, display: 'inline-block' } },
  parameters: { layout: 'fullscreen' },
};

export const CenteredBlock = {
  args: { text: 'centered' },
  parameters: { layout: 'centered' },
};

export const CenteredInline = {
  args: { text: 'centered', style: { ...style, display: 'inline-block' } },
  parameters: { layout: 'centered' },
};

export const CenteredTall = {
  args: { text: 'centered tall', style: { ...style, height: '120vh' } },
  parameters: { layout: 'centered' },
};

export const CenteredWide = {
  args: { text: 'centered wide', style: { ...style, width: '120vw' } },
  parameters: { layout: 'centered' },
};

export const None = {
  args: { text: 'none' },
  parameters: { layout: 'none' },
};

export const Inherited = {
  args: { text: 'inherited' },
};

export const Invalid = {
  args: { text: 'invalid' },
  parameters: { layout: 'invalid' },
};
