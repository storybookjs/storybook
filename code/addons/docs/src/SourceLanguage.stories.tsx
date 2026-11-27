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

const SourceLanguage = ({
  children,
  ...props
}: React.ComponentProps<typeof SourcePreview> & { children?: React.ReactNode }) => {
  const [channel] = useState(() => new Channel({}));
  const emit = (source: string, language?: SupportedLanguage) =>
    channel.emit(SNIPPET_RENDERED, { id: storyId, args: storyArgs, source, language });
  return (
    <SourceContainer channel={channel}>
      <button onClick={() => emit('<p>HTML snippet</p>', 'html')}>Emit HTML</button>
      <button onClick={() => emit('{"message":"JSON snippet"}', 'json')}>Emit JSON</button>
      <button onClick={() => emit('no language')}>Emit without language</button>
      <button onClick={() => channel.emit(SNIPPET_RENDERED, storyId, 'legacy snippet', false)}>
        Emit legacy snippet
      </button>
      {children ?? <SourcePreview {...props} />}
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
    await userEvent.click(canvas.getByRole('button', { name: 'Emit legacy snippet' }));
    await waitFor(() => {
      expect(canvasElement.querySelector('.language-jsx')).toHaveTextContent('legacy snippet');
    });
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

const precedenceCases = [
  {
    name: 'Prop overrides parameter and event',
    props: { language: 'css', parameterLanguage: 'json' },
    language: 'css',
    code: 'HTML snippet',
  },
  {
    name: 'Parameter overrides event',
    props: { parameterLanguage: 'json' },
    language: 'json',
    code: 'HTML snippet',
  },
  {
    name: 'Explicit code',
    props: { code: 'explicit code' },
    language: 'jsx',
    code: 'explicit code',
  },
  { name: 'Original source', props: { type: SourceType.CODE }, language: 'jsx', code: 'original' },
  {
    name: 'Synchronous transform',
    props: { transform: (code: string) => `Transformed: ${code}` },
    language: 'html',
    code: 'Transformed:',
  },
  {
    name: 'Service snippet',
    props: { serviceSnippet: 'service snippet' },
    language: 'jsx',
    code: 'service snippet',
  },
  {
    name: 'Parameter code',
    props: { parameterCode: 'parameter code' },
    language: 'jsx',
    code: 'parameter code',
  },
] satisfies {
  name: string;
  props: React.ComponentProps<typeof SourcePreview>;
  language: SupportedLanguage;
  code: string;
}[];

export const SourcePrecedence: Story = {
  render: () => (
    <SourceLanguage>
      {precedenceCases.map(({ name, props }) => (
        <section key={name} aria-label={name}>
          <SourcePreview {...props} />
        </section>
      ))}
    </SourceLanguage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Emit HTML' }));
    for (const { name, language, code } of precedenceCases) {
      const region = canvas.getByRole('region', { name });
      await waitFor(() =>
        expect(region.querySelector(`.language-${language}`)).toHaveTextContent(code)
      );
    }
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
      const request = requests.get(key) ?? Promise.withResolvers<string>();
      requests.set(key, request);
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
