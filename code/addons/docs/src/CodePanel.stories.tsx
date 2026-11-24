import React, { useRef, useState } from 'react';

import { Channel } from 'storybook/internal/channels';
import { STORY_PREPARED } from 'storybook/internal/core-events';
import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { ManagerContext } from 'storybook/manager-api';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, waitFor, within } from 'storybook/test';

import type { SourceParameters } from './blocks/blocks/Source.tsx';
import { CodePanel } from './CodePanel.tsx';

const CodePanelFixture = () => {
  const [channel] = useState(() => new Channel({}));
  const [storyId, setStoryId] = useState('example--first');
  const source = useRef<SourceParameters>({ originalSource: 'original first story' });
  const [managerContext] = useState(
    () =>
      ({
        state: {},
        api: {
          on: channel.on.bind(channel),
          off: channel.off.bind(channel),
          emit: channel.emit.bind(channel),
          getCurrentParameter: () => ({ source: source.current }),
        },
      }) as unknown as React.ComponentProps<typeof ManagerContext.Provider>['value']
  );
  const updateSource = (nextSource: SourceParameters) => {
    source.current = nextSource;
    channel.emit(STORY_PREPARED, { id: storyId });
  };

  const emit = (text: string, language?: 'html' | 'json' | 'css', id = storyId) =>
    channel.emit(SNIPPET_RENDERED, { id, source: text, language });

  return (
    <ManagerContext.Provider value={managerContext}>
      <button onClick={() => emit('<p>HTML snippet</p>', 'html')}>Emit HTML</button>
      <button onClick={() => emit('{"message":"JSON snippet"}', 'json')}>Emit JSON</button>
      <button onClick={() => emit('no language')}>Emit without language</button>
      <button onClick={() => updateSource({ ...source.current, language: 'json' })}>
        Set language override
      </button>
      <button onClick={() => updateSource({ ...source.current, language: undefined })}>
        Remove language override
      </button>
      <button onClick={() => updateSource({ ...source.current, code: '<p>HTML snippet</p>' })}>
        Set code override
      </button>
      <button
        onClick={() => {
          setStoryId('example--second');
          updateSource({ originalSource: 'original second story' });
        }}
      >
        Next story
      </button>
      <button onClick={() => emit('stale snippet', 'css', 'example--first')}>
        Emit previous story
      </button>
      <CodePanel
        active
        currentStoryId={storyId}
        lastEvent={undefined}
        storyParameters={undefined}
        storyPrepared
      />
    </ManagerContext.Provider>
  );
};

const meta = {
  component: CodePanelFixture,
  tags: ['vitest'],
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof CodePanelFixture>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LanguageEventsAndOverrides: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('JSON snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Emit without language' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('no language')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Set language override' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('HTML snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Remove language override' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Set code override' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('HTML snippet')
    );
  },
};

export const StoryNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Next story' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent(
        'original second story'
      )
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Emit previous story' }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
    expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('original second story');
    expect(canvasElement.querySelector('.language-css')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('JSON snippet')
    );
  },
};
