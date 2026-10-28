import type React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { within } from '@storybook/core/test';

/** Plain CSS keeps this core story free of the manager theming package. */
const STYLES = `
  @keyframes sb-animations-fade-in {
    from {
      opacity: 0;
      scale: 0.5;
    }
    to {
      opacity: 1;
      scale: 1;
    }
  }
  @keyframes sb-animations-rotate {
    0% {
      transform: rotate(0deg);
      color: crimson;
    }
    100% {
      transform: rotate(360deg);
      color: yellow;
    }
  }
  @keyframes sb-animations-grow-progress {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  .sb-animations-button {
    background: crimson;
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    border: none;
    transition: background 3s linear;
  }
  .sb-animations-button:focus {
    background: mediumblue;
    outline: none;
  }
`;

const Component = ({
  styles,
  children,
}: {
  styles?: React.CSSProperties;
  children?: React.ReactNode;
}): React.ReactElement => (
  <div style={{ display: 'inline-block', ...styles }}>
    <style>{STYLES}</style>
    {children}
  </div>
);

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
      animation: 'sb-animations-fade-in 3s linear',
    },
  },
};

export const Infinite: Story = {
  args: {
    styles: {
      animation: 'sb-animations-rotate 3s linear infinite alternate',
    },
  },
};

const Container = ({ children }: { children?: React.ReactNode }): React.ReactElement => (
  <div
    style={{
      height: '150vh',
      width: '100vw',
      background: 'linear-gradient(to bottom, white, silver)',
      position: 'relative',
      textAlign: 'center',
      padding: '120px 0',
    }}
  >
    {children}
  </div>
);

const Bar = (): React.ReactElement => (
  <div
    style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '100%',
      height: 10,
      background: 'crimson',
      transformOrigin: '0 50%',
      animation: 'sb-animations-grow-progress auto linear',
      animationTimeline: 'scroll()',
    }}
  />
);

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

const Button = ({ children }: { children?: React.ReactNode }): React.ReactElement => (
  <button className="sb-animations-button">{children}</button>
);

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
