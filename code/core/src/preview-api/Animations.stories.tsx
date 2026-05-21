import type React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { within } from 'storybook/test';
import { keyframes, styled } from 'storybook/theming';

const fadeIn = keyframes`
  from {
    opacity: 0;
    scale: 0.5;
  }
  to {
    opacity: 1;
    scale: 1;
  }
`;

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
    color: crimson;
  }
  100% {
    transform: rotate(360deg);
    color: yellow;
  }
`;

const growProgress = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const Component = styled.div(({ styles }: { styles?: React.CSSProperties }) => ({
  display: 'inline-block',
  ...styles,
}));

const meta = {
  component: Component,
  title: 'Animations',
  args: {
    children: <strong>Content</strong>,
  },
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FadeIn: Story = {
  args: {
    styles: {
      animation: `${fadeIn} 3s linear`,
    },
  },
};

export const Infinite: Story = {
  args: {
    styles: {
      animation: `${rotate} 3s linear infinite alternate`,
    },
  },
  play: async () => {
    // Wait for the animation to run to its end frame (yellow).
    // This would cause the color-contrast check to fail, but the accessibility addon handles
    // that by pausing all animations before running the test and restoring them afterwards.
    // If needed, users can also import and call `pauseAnimations` from `storybook/preview-api`.
    await new Promise((resolve) => setTimeout(resolve, 3000));
  },
};

const Container = styled.div({
  height: '150vh',
  width: '100vw',
  background: 'linear-gradient(to bottom, white, silver)',
  position: 'relative',
  textAlign: 'center',
  padding: '120px 0',
});

const Bar = styled.div({
  position: 'fixed',
  left: 0,
  top: 0,
  width: '100%',
  height: 10,
  background: 'crimson',
  transformOrigin: '0 50%',
  animation: `${growProgress} auto linear`,
  animationTimeline: 'scroll()',
});

export const Scroll: Story = {
  args: {
    children: (
      <Container>
        <Bar />
        <span>A red bar appears as you scroll ↓</span>
      </Container>
    ),
  },
  play: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    window.scroll({ top: 100, behavior: 'smooth' });
    await new Promise((resolve) => setTimeout(resolve, 300));
  },
  parameters: {
    layout: 'fullscreen',
  },
};

const Button = styled.button({
  background: 'crimson',
  color: 'white',
  padding: '10px 20px',
  borderRadius: '5px',
  border: 'none',
  transition: 'background 3s linear',
  '&:focus': {
    background: 'mediumblue',
    outline: 'none',
  },
});

export const Transition: Story = {
  args: {
    children: (
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button>I turn blue</Button>
        <Button>I stay red</Button>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [button] = await canvas.findAllByRole('button');
    button.focus();
  },
};
