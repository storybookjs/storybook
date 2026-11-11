import React, { useId, useLayoutEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

import { renderElement, unmountElement } from '../react-dom-client.tsx';

const LayoutEffectContent = () => {
  const [hasCommitted, setHasCommitted] = useState(false);

  useLayoutEffect(() => {
    setHasCommitted(true);
  }, []);

  return <div>{hasCommitted ? 'committed' : 'pending'}</div>;
};

const meta = {
  title: 'React/React DOM Client',
  component: LayoutEffectContent,
} satisfies Meta<typeof LayoutEffectContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Lifecycle: Story = {
  play: async ({ canvas }) => {
    const element = document.createElement('div');
    const immediatelyUnmountedElement = document.createElement('div');
    const layoutEffectElement = document.createElement('div');
    document.body.appendChild(element);
    document.body.appendChild(immediatelyUnmountedElement);
    document.body.appendChild(layoutEffectElement);

    let instanceCount = 0;
    const Stateful = () => {
      const [instanceId] = useState(() => ++instanceCount);
      const id = useId();
      return (
        <div data-id={id} data-testid="stateful">
          instance {instanceId}
        </div>
      );
    };

    await expect(canvas.getByText('committed')).toBeInTheDocument();

    try {
      await renderElement(<LayoutEffectContent />, layoutEffectElement);
      await expect(layoutEffectElement).toHaveTextContent('committed');

      const interruptedRender = renderElement(<LayoutEffectContent />, immediatelyUnmountedElement);
      unmountElement(immediatelyUnmountedElement);
      await expect(
        Promise.race([
          interruptedRender.then(() => 'settled'),
          new Promise((resolve) => setTimeout(() => resolve('pending'), 100)),
        ])
      ).resolves.toBe('settled');

      await renderElement(<Stateful />, element, { identifierPrefix: 'first-' });
      const firstIdentifier = element
        .querySelector('[data-testid="stateful"]')
        ?.getAttribute('data-id');
      await expect(firstIdentifier).toContain('first-');

      await renderElement(<Stateful />, element, { identifierPrefix: 'second' });
      await expect(element).toHaveTextContent('instance 1');
      await expect(element.querySelector('[data-testid="stateful"]')?.getAttribute('data-id')).toBe(
        firstIdentifier
      );

      unmountElement(element);
      unmountElement(element);
      await renderElement(<Stateful />, element);
      await expect(element).toHaveTextContent('instance 2');
    } finally {
      unmountElement(element);
      unmountElement(immediatelyUnmountedElement);
      unmountElement(layoutEffectElement);
      element.remove();
      immediatelyUnmountedElement.remove();
      layoutEffectElement.remove();
    }
  },
};
