import React, { useLayoutEffect, useState } from 'react';

import { expect } from 'storybook/test';

import type { Meta, StoryObj } from '../index.ts';
import { renderToCanvas } from '../renderToCanvas.tsx';

const LayoutEffectContent = () => {
  const [hasCommitted, setHasCommitted] = useState(false);

  useLayoutEffect(() => {
    setHasCommitted(true);
  }, []);

  return <div>{hasCommitted ? 'committed' : 'pending'}</div>;
};

const meta = {
  title: 'React/Render to Canvas',
  component: LayoutEffectContent,
  tags: ['vitest'],
} satisfies Meta<typeof LayoutEffectContent>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AwaitsDocsLayoutEffects: Story = {
  play: async ({ context }) => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    let teardown: (() => Promise<void>) | undefined;

    try {
      teardown = await renderToCanvas(
        {
          componentId: context.componentId,
          title: context.title,
          kind: context.kind,
          id: context.id,
          name: context.name,
          story: context.story,
          tags: context.tags,
          showMain: () => {},
          showError: () => {},
          showException: () => {},
          forceRemount: true,
          storyContext: { ...context, viewMode: 'docs' },
          storyFn: () => <LayoutEffectContent />,
          unboundStoryFn: LayoutEffectContent,
        },
        element
      );
      await expect(element).toHaveTextContent('committed');
    } finally {
      await teardown?.();
      element.remove();
    }
  },
};
