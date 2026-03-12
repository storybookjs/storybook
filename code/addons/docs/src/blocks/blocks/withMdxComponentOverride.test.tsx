// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { FC } from 'react';
import React from 'react';

import { MDXProvider } from '@mdx-js/react';

import { withMdxComponentOverride } from './withMdxComponentOverride';

afterEach(() => {
  cleanup();
});

type TestBlockProps = {
  label: string;
};

const TestBlockImpl: FC<TestBlockProps> = ({ label }) => <span data-testid="default">{label}</span>;
const TestBlock = withMdxComponentOverride('TestBlock', TestBlockImpl);

describe('withMdxComponentOverride', () => {
  it('renders the default block when there is no override', () => {
    render(<TestBlock label="Hello" />);

    expect(screen.getByTestId('default')).toHaveTextContent('Hello');
  });

  it('renders the MDX override when one is provided', () => {
    const Override: FC<TestBlockProps> = ({ label }) => <span data-testid="override">{label}</span>;

    render(
      <MDXProvider components={{ TestBlock: Override }}>
        <TestBlock label="Hello" />
      </MDXProvider>
    );

    expect(screen.getByTestId('override')).toHaveTextContent('Hello');
  });

  it('falls back to the default block when the override resolves to the wrapped block itself', () => {
    render(
      <MDXProvider components={{ TestBlock }}>
        <TestBlock label="Hello" />
      </MDXProvider>
    );

    expect(screen.getByTestId('default')).toHaveTextContent('Hello');
  });
});
