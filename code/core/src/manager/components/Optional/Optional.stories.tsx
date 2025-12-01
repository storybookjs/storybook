import type { Meta, StoryObj } from '@storybook/react-vite';

import { keyframes, styled } from 'storybook/theming';

import { Optional } from './Optional';

const resize = keyframes`
  to {
    width: 150px;
  }
`;

const Resizing = styled.div({
  display: 'inline-flex',
  justifyContent: 'space-between',
  width: '250px',
  animation: `${resize} 3s ease-in-out infinite alternate`,
  border: '1px solid silver',
});

const meta: Meta<typeof Optional> = {
  title: 'Optional',
  component: Optional,
  decorators: [
    (Story) => (
      <Resizing>
        <Story />
        <div style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>Other stuff</div>
      </Resizing>
    ),
  ],
};

export default meta;

export const Default: StoryObj<typeof Optional> = {
  args: {
    content: (
      <div style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'papayawhip' }}>
        Optional content
      </div>
    ),
  },
};

export const Fallback: StoryObj<typeof Optional> = {
  args: {
    content: (
      <div style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'papayawhip' }}>
        Optional content
      </div>
    ),
    fallback: (
      <div style={{ display: 'inline-block', whiteSpace: 'nowrap', background: 'palevioletred' }}>
        Fallback
      </div>
    ),
  },
};
