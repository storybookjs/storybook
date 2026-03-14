/**
 * These stories use JSX so they are not part of the template stories. Even though they _do_ work in
 * non-React frameworks, we are keeping them out of the sandboxes and only have them in the main UI
 * Storybook.
 */
import React from 'react';
import type { FC, ReactNode } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Title as DocsTitle } from '@storybook/addon-docs/blocks';

import { MDXProvider } from '@mdx-js/react';
import { expect } from 'storybook/test';

import { withMdxComponentOverride } from './blocks/with-mdx-component-override';

type OverrideProps = {
  children?: ReactNode;
};

type TestBlockProps = {
  label: string;
};

const OverrideShell = ({ name, children }: { name: string; children?: ReactNode }) => (
  <div
    data-testid={`override-${name}`}
    style={{
      border: '2px solid #ff4785',
      borderRadius: 6,
      color: '#ff4785',
      fontFamily: 'monospace',
      margin: '8px 0',
      padding: '8px 12px',
    }}
  >
    override:{name}
    {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
  </div>
);

const createOverride = (name: string, renderChildren = false): FC<OverrideProps> =>
  function Override({ children }) {
    return <OverrideShell name={name}>{renderChildren ? children : null}</OverrideShell>;
  };

const RecursiveTitleOverride: FC<OverrideProps> = (props) => (
  <OverrideShell name="Title (via <Title /> composition)">
    <DocsTitle {...props} />
  </OverrideShell>
);

const TestBlockImpl: FC<TestBlockProps> = ({ label }) => (
  <span data-testid="default">default:{label}</span>
);
const TestBlock = withMdxComponentOverride('TestBlock', TestBlockImpl);

const SubtitleBlockImpl: FC<TestBlockProps> = ({ label }) => (
  <span data-testid="subtitle">subtitle:{label}</span>
);
const SubtitleBlock = withMdxComponentOverride('SubtitleBlock', SubtitleBlockImpl);

const TestBlockOverride: FC<TestBlockProps> = ({ label }) => (
  <span data-testid="override">override:{label}</span>
);

const RecursiveTestBlockOverride: FC<TestBlockProps> = (props) => <TestBlock {...props} />;

type TestBlockComponents = {
  TestBlock: React.ComponentType<TestBlockProps>;
};

const renderTestBlock = (components: TestBlockComponents | undefined) => (
  <MDXProvider components={components as React.ComponentProps<typeof MDXProvider>['components']}>
    <TestBlock label="Hello" />
  </MDXProvider>
);

const meta = {
  tags: ['autodocs'],
  args: {
    label: 'Primary action',
  },
  parameters: {
    docs: {
      name: 'ComponentOverrides',
      subtitle: 'Subtitle supplied from docs parameters',
      description: {
        component: 'Component description used by the Description block.',
      },
      components: {
        ArgTypes: createOverride('ArgTypes'),
        Canvas: createOverride('Canvas'),
        Controls: createOverride('Controls'),
        Description: createOverride('Description'),
        DocsStory: createOverride('DocsStory'),
        Heading: createOverride('Heading', true),
        Markdown: createOverride('Markdown', true),
        Primary: createOverride('Primary'),
        Source: createOverride('Source'),
        Stories: createOverride('Stories'),
        Story: createOverride('Story'),
        Subheading: createOverride('Subheading', true),
        Subtitle: createOverride('Subtitle'),
        Title: RecursiveTitleOverride,
        Unstyled: createOverride('Unstyled', true),
        Wrapper: createOverride('Wrapper', true),
      },
    },
  },
} satisfies Meta<typeof TestBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const UsesDefaultImplementation: Story = {
  render: () => renderTestBlock(undefined),
  play: async ({ canvas }) => {
    await expect(canvas.findByTestId('default')).resolves.toHaveTextContent('default:Hello');
  },
};

export const UsesMdxOverride: Story = {
  render: () => renderTestBlock({ TestBlock: TestBlockOverride }),
  play: async ({ canvas }) => {
    await expect(canvas.findByTestId('override')).resolves.toHaveTextContent('override:Hello');
  },
};

export const FallsBackWhenOverrideIsWrappedBlock: Story = {
  render: () => renderTestBlock({ TestBlock }),
  play: async ({ canvas }) => {
    await expect(canvas.findByTestId('default')).resolves.toHaveTextContent('default:Hello');
  },
};

export const FallsBackWhenOverrideComposesPublicBlock: Story = {
  render: () => renderTestBlock({ TestBlock: RecursiveTestBlockOverride }),
  play: async ({ canvas }) => {
    await expect(canvas.findByTestId('default')).resolves.toHaveTextContent('default:Hello');
  },
};

export const AllowsDifferentWrappedBlockOverride: Story = {
  render: () => renderTestBlock({ TestBlock: SubtitleBlock }),
  play: async ({ canvas }) => {
    await expect(canvas.findByTestId('subtitle')).resolves.toHaveTextContent('subtitle:Hello');
  },
};
