import React, { useLayoutEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

import { renderElement, unmountElement } from './react-dom-client.tsx';

const LayoutEffectContent = () => {
  const [hasCommitted, setHasCommitted] = useState(false);

  useLayoutEffect(() => {
    setHasCommitted(true);
  }, []);

  return <div>{hasCommitted ? 'committed' : 'pending'}</div>;
};

const meta = {
  title: 'Preview/React DOM Client',
  component: LayoutEffectContent,
} satisfies Meta<typeof LayoutEffectContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Lifecycle: Story = {
  play: async ({ canvas }) => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    let instanceCount = 0;
    const Stateful = () => {
      const [instanceId] = useState(() => ++instanceCount);
      return <div>instance {instanceId}</div>;
    };

    await expect(canvas.getByText('committed')).toBeInTheDocument();

    try {
      await renderElement(<LayoutEffectContent />, element);
      await expect(element).toHaveTextContent('committed');

      await renderElement(<Stateful />, element, { identifierPrefix: 'first' });
      await renderElement(<Stateful />, element, { identifierPrefix: 'second' });
      await expect(element).toHaveTextContent('instance 1');

      unmountElement(element);
      unmountElement(element);
      await renderElement(<Stateful />, element);
      await expect(element).toHaveTextContent('instance 2');
    } finally {
      unmountElement(element);
      element.remove();
    }
  },
};
