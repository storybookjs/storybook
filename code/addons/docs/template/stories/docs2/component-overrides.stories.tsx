import type { FC, ReactNode } from 'react';
import React, { useContext } from 'react';

import { DocsContext } from '@storybook/addon-docs/blocks';

type OverrideProps = {
  children?: ReactNode;
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

const MetaOverride = ({ of }: { of?: unknown }) => {
  const context = useContext(DocsContext);

  if (of) {
    context.referenceMeta(of, true);
  }

  return <OverrideShell name="Meta" />;
};

const meta = {
  title: 'Docs2/ComponentOverrides',
  component: globalThis.__TEMPLATE_COMPONENTS__.Button,
  tags: ['autodocs'],
  args: {
    label: 'Primary action',
  },
  argTypes: {
    backgroundColor: { control: 'color' },
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
        Meta: MetaOverride,
        Primary: createOverride('Primary'),
        Source: createOverride('Source'),
        Stories: createOverride('Stories'),
        Story: createOverride('Story'),
        Subheading: createOverride('Subheading', true),
        Subtitle: createOverride('Subtitle'),
        Title: createOverride('Title'),
        Unstyled: createOverride('Unstyled', true),
        Wrapper: createOverride('Wrapper', true),
      },
    },
    chromatic: { disableSnapshot: true },
  },
};

export default meta;

export const Basic = {
  args: {
    label: 'Basic',
  },
  parameters: {
    docs: {
      description: {
        story: 'Story description used by Story/DocsStory references.',
      },
      source: {
        code: '<Button label="Basic" />',
      },
    },
  },
};

export const Secondary = {
  args: {
    label: 'Secondary',
    primary: false,
  },
};
