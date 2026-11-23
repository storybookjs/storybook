// @vitest-environment happy-dom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { useArgs } from 'storybook/preview-api';

import { composeStory } from '../index.ts';

afterEach(() => {
  cleanup();
});

// Suspends until the data is loaded, like a server component that fetches.
let loaded = false;
const loading = new Promise<void>((resolve) =>
  setTimeout(() => {
    loaded = true;
    resolve();
  }, 50)
);
const Slow = () => {
  if (!loaded) {
    throw loading;
  }
  return <span>slow content</span>;
};

describe('RSC', () => {
  it('keeps hooks working when a child of the story suspends', async () => {
    const Story = composeStory(
      {
        args: { count: 0 },
        parameters: { react: { rsc: true } },
        render: function Render() {
          const [{ count }] = useArgs<{ count: number }>();
          return (
            <>
              <span>count {count}</span>
              <Slow />
            </>
          );
        },
      },
      { title: 'RSC' }
    );

    // run() renders the story and then clears the hooks context, as the browser does once the
    // story has rendered. The child is still suspended at that point, and when it resolves React
    // must not call the story function again.
    await Story.run();

    expect(await screen.findByText('slow content', {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText('count 0')).toBeTruthy();
  });
});
