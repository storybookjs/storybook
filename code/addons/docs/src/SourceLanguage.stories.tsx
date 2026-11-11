import React, { useContext, useState } from 'react';

import { Channel } from 'storybook/internal/channels';
import type { SupportedLanguage } from 'storybook/internal/components';
import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import type { DocsContextProps } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, userEvent, waitFor, within } from 'storybook/test';

import { useSourceProps, type SourceProps } from './blocks/blocks/Source.tsx';
import { SourceContainer, SourceContext } from './blocks/blocks/SourceContainer.tsx';
import { Source } from './blocks/components/Source.tsx';

const storyId = 'example--primary';
const storyArgs = { label: 'Example' };

const SourcePreview = ({
  language,
  parameterLanguage,
  code,
  type = SourceType.DYNAMIC,
  transform,
  serviceSnippet,
  parameterCode,
  contextLabel,
}: {
  language?: SupportedLanguage;
  parameterLanguage?: SupportedLanguage;
  code?: string;
  type?: SourceType;
  transform?: SourceProps['transform'];
  serviceSnippet?: string;
  parameterCode?: string;
  contextLabel?: string;
}) => {
  const sourceContext = useContext(SourceContext);
  const parameters = {
    docs: {
      source: { language: parameterLanguage, code: parameterCode, originalSource: 'original' },
    },
  };
  const docsContext = {
    storyById: () => ({ id: storyId, parameters }),
    getStoryContext: () => ({
      parameters,
      unmappedArgs: storyArgs,
      initialArgs: storyArgs,
      globals: { label: contextLabel },
    }),
  } as unknown as DocsContextProps;
  const props = useSourceProps(
    { language, code, type, transform },
    docsContext,
    sourceContext,
    serviceSnippet
  );
  return props.code ? <Source {...props} /> : null;
};

const SourceLanguage = (props: React.ComponentProps<typeof SourcePreview>) => {
  const [channel] = useState(() => new Channel({}));
  return (
    <SourceContainer channel={channel}>
      <button
        onClick={() =>
          channel.emit(SNIPPET_RENDERED, {
            id: storyId,
            args: storyArgs,
            source: '<p>HTML snippet</p>',
            language: 'html',
          })
        }
      >
        Emit HTML
      </button>
      <button
        onClick={() =>
          channel.emit(SNIPPET_RENDERED, {
            id: storyId,
            args: storyArgs,
            source: '{"message":"JSON snippet"}',
            language: 'json',
          })
        }
      >
        Emit JSON
      </button>
      <button
        onClick={() =>
          channel.emit(SNIPPET_RENDERED, { id: storyId, args: storyArgs, source: 'no language' })
        }
      >
        Emit without language
      </button>
      <button onClick={() => channel.emit(SNIPPET_RENDERED, storyId, 'legacy snippet', false)}>
        Emit legacy snippet
      </button>
      <SourcePreview {...props} />
    </SourceContainer>
  );
};

const meta = {
  component: SourceLanguage,
  tags: ['vitest'],
  parameters: { chromatic: { disableSnapshot: true } },
} satisfies Meta<typeof SourceLanguage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmittedLanguage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet');
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('JSON snippet');
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Emit without language' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('no language');
    });
  },
};

export const PropOverridesLanguage: Story = {
  args: { language: 'css', parameterLanguage: 'json' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-css')).toHaveTextContent('HTML snippet');
    });
  },
};

export const ParameterOverridesLanguage: Story = {
  args: { parameterLanguage: 'json' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('HTML snippet');
    });
  },
};

export const ExplicitCode: Story = {
  args: { code: 'explicit code' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('explicit code');
    });
  },
};

export const OriginalSource: Story = {
  args: { type: SourceType.CODE },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('original');
    });
  },
};

export const LegacyEvent: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Emit legacy snippet' })
    );
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('legacy snippet');
    });
  },
};

export const TransformedSnippet: Story = {
  args: { transform: (code) => `Transformed: ${code}` },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('Transformed:');
    });
  },
};

export const ServiceSnippet: Story = {
  args: { serviceSnippet: 'service snippet' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('service snippet');
    });
  },
};

export const ParameterCode: Story = {
  args: { parameterCode: 'parameter code' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Emit HTML' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('parameter code');
    });
  },
};

const HTML_SNIPPET = '<p>HTML snippet</p>';
const JSON_SNIPPET = '{"message":"JSON snippet"}';

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const DeferredSourceLanguage = ({ sameOutput = false }: { sameOutput?: boolean }) => {
  const [requests] = useState(
    () => new Map<string, { promise: Promise<string>; resolve: (code: string) => void }>()
  );
  const [contextLabel, setContextLabel] = useState('initial');
  const [mode, setMode] = useState<'async' | 'sync' | 'none'>('async');
  const [transform] = useState<NonNullable<SourceProps['transform']>>(
    (): NonNullable<SourceProps['transform']> => (code, context) => {
      if (!code) {
        return code;
      }
      const key = `${context.globals.label}:${code}`;
      let request = requests.get(key);
      if (!request) {
        let resolve!: (code: string) => void;
        const promise = new Promise<string>((complete) => {
          resolve = complete;
        });
        request = { promise, resolve };
        requests.set(key, request);
      }
      return request.promise;
    }
  );
  const complete = (code: string) => {
    requests
      .get(`${contextLabel}:${code}`)
      ?.resolve(sameOutput ? 'same output' : `${contextLabel}: ${code}`);
  };

  return (
    <>
      <button onClick={() => complete(HTML_SNIPPET)}>Resolve HTML</button>
      <button onClick={() => complete(JSON_SNIPPET)}>Resolve JSON</button>
      <button onClick={() => complete('no language')}>Resolve without language</button>
      <button onClick={() => setMode('sync')}>Use synchronous transform</button>
      <button onClick={() => setMode('none')}>Remove transform</button>
      <button onClick={() => setContextLabel('updated')}>Update context</button>
      <SourceLanguage
        contextLabel={contextLabel}
        transform={
          mode === 'async' ? transform : mode === 'sync' ? (code) => `Sync: ${code}` : undefined
        }
      />
    </>
  );
};

export const AsyncLanguageSwitch: Story = {
  render: () => <DeferredSourceLanguage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    expect(canvasElement.querySelector('.language-html')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    expect(canvasElement.querySelector('.language-html')).toHaveTextContent('HTML snippet');
    expect(canvasElement.querySelector('.language-json')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve JSON' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('JSON snippet')
    );
  },
};

export const SupersededTransform: Story = {
  render: () => <DeferredSourceLanguage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitForNextPaint();
    expect(canvasElement.querySelector('.language-json')).not.toBeInTheDocument();
    expect(canvasElement.querySelector('.language-html')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve JSON' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('JSON snippet')
    );
  },
};

export const SameOutputDifferentLanguage: Story = {
  render: () => <DeferredSourceLanguage sameOutput />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('same output')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    expect(canvasElement.querySelector('.language-html')).toHaveTextContent('same output');
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve JSON' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('same output')
    );
  },
};

export const TransformChanges: Story = {
  render: () => <DeferredSourceLanguage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Emit JSON' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Use synchronous transform' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent('Sync:')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitForNextPaint();
    expect(canvasElement.querySelector('.language-json')).toHaveTextContent('Sync:');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove transform' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve JSON' }));
    await waitForNextPaint();
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-json')).toHaveTextContent(JSON_SNIPPET)
    );
    expect(canvasElement.querySelector('.language-json')).not.toHaveTextContent('Sync:');
    expect(canvasElement.querySelector('.language-json')).not.toHaveTextContent('initial:');
  },
};

export const TransformContextChanges: Story = {
  render: () => <DeferredSourceLanguage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('initial:')
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Update context' }));
    expect(canvasElement.querySelector('.language-html')).toHaveTextContent('initial:');
    await userEvent.click(canvas.getByRole('button', { name: 'Resolve HTML' }));
    await waitFor(() =>
      expect(canvasElement.querySelector('.language-html')).toHaveTextContent('updated:')
    );
  },
};
