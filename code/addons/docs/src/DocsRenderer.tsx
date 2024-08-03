import type { PropsWithChildren } from 'react';
import React, { Component } from 'react';
import { renderElement, unmountElement } from '@storybook/react-dom-shim';
import type {
  Renderer,
  Parameters,
  DocsContextProps,
  DocsRenderFunction,
} from 'storybook/internal/types';
import { Docs, CodeOrSourceMdx, AnchorMdx, HeadersMdx } from '@storybook/blocks';

// TS doesn't like that we export a component with types that it doesn't know about (TS4203)
export const defaultComponents: Record<string, any> = {
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

export class DocsRenderer<TRenderer extends Renderer> {
  public render: DocsRenderFunction<TRenderer>;

  public unmount: (element: HTMLElement) => void;

  constructor() {
    this.render = async (
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
        import('@mdx-js/react')
          .then(({ MDXProvider }) =>
            // We use a `key={}` here to reset the `hasError` state each time we render ErrorBoundary
            renderElement(
              <ErrorBoundary showException={reject} key={Math.random()}>
                <MDXProvider components={components}>
                  <TDocs context={context} docsParameter={docsParameter} />
                </MDXProvider>
              </ErrorBoundary>,
              element
            )
          )
          .then(() => resolve());
      });
    };

    this.unmount = (element: HTMLElement) => {
      unmountElement(element);
    };
  }
}
