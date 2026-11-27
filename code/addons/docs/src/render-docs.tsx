import type { PropsWithChildren } from 'react';
import React, { Component } from 'react';

import type { DocsContextProps, Parameters, Renderer } from 'storybook/internal/types';

// Not `./blocks.ts`: the build keeps the package name external, so MDX files share these blocks.
import { AnchorMdx, CodeOrSourceMdx, Docs, HeadersMdx } from '@storybook/addon-docs/blocks';

import { MDXProvider } from '@mdx-js/react';

import { renderElement, unmountElement } from '../../../renderers/react/src/react-dom-client.tsx';

const defaultComponents = {
  code: CodeOrSourceMdx,
  a: AnchorMdx,
  ...HeadersMdx,
};

class ErrorBoundary extends Component<
  PropsWithChildren<{
    showException: (err: Error) => void;
  }>
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    const { showException } = this.props;
    showException(err);
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    return hasError ? null : <>{children}</>;
  }
}

export const renderDocs = <TRenderer extends Renderer>(
  context: DocsContextProps<TRenderer>,
  docsParameter: Parameters,
  element: HTMLElement
): Promise<void> => {
  const components = {
    ...defaultComponents,
    ...docsParameter?.components,
  };

  const TDocs = Docs as typeof Docs<TRenderer>;

  return new Promise((resolve, reject) => {
    // We use a `key={}` here to reset the `hasError` state each time we render ErrorBoundary
    renderElement(
      <ErrorBoundary showException={reject} key={Math.random()}>
        <MDXProvider components={components}>
          <TDocs context={context} docsParameter={docsParameter} />
        </MDXProvider>
      </ErrorBoundary>,
      element
    ).then(() => resolve());
  });
};

export { unmountElement as unmountDocs };
