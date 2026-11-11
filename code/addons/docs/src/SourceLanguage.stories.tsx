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
}: {
  language?: SupportedLanguage;
  parameterLanguage?: SupportedLanguage;
  code?: string;
  type?: SourceType;
  transform?: SourceProps['transform'];
  serviceSnippet?: string;
  parameterCode?: string;
}) => {
  const sourceContext = useContext(SourceContext);
  const parameters = {
    docs: {
      source: { language: parameterLanguage, code: parameterCode, originalSource: 'original' },
    },
  };
  const docsContext = {
    storyById: () => ({ id: storyId, parameters }),
    getStoryContext: () => ({ parameters, unmappedArgs: storyArgs, initialArgs: storyArgs }),
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
