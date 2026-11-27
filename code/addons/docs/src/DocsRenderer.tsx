import type { PropsWithChildren } from 'react';
import React, { Component } from 'react';

import type {
  DocsContextProps,
  DocsRenderFunction,
  Parameters,
  Renderer,
} from 'storybook/internal/types';

import { renderElement, unmountElement } from '../../../renderers/react/src/react-dom-client.tsx';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (these types only work once the package is compiled)
import { AnchorMdx, CodeOrSourceMdx, Docs, HeadersMdx } from '@storybook/addon-docs/blocks';

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

// Keys are handed out from a single counter, so an unchanged key means "the same docs page".
let nextTreeKey = 0;

export class DocsRenderer<TRenderer extends Renderer> {
  public render: DocsRenderFunction<TRenderer>;

  public unmount: (element: HTMLElement) => void;

  /**
   * Key of the error boundary around the docs tree. It stays the same for re-renders of this docs
   * page, so React reconciles the tree (and inline stories keep their state) instead of remounting
   * it. It changes when another docs page takes over, and after the boundary caught an error so the
   * next render starts with a clean `hasError` state.
   */
  private treeKey = nextTreeKey++;

  /**
   * The docs page currently rendered. A docs render creates its `DocsContext` once and passes the
   * same instance to every re-render, so a different context means another page took over.
   */
  private mountedContext?: DocsContextProps<TRenderer>;

  constructor() {
    this.render = async (
      context: DocsContextProps<TRenderer>,
      docsParameter: Parameters,
      element: HTMLElement
    ): Promise<void> => {
      if (this.mountedContext !== context) {
        this.mountedContext = context;
        this.treeKey = nextTreeKey++;
      }

      const components = {
        ...defaultComponents,
        ...docsParameter?.components,
      };

      const TDocs = Docs as typeof Docs<TRenderer>;

      return new Promise((resolve, reject) => {
        import('@mdx-js/react')
          .then(({ MDXProvider }) =>
            renderElement(
              <ErrorBoundary
                showException={(err) => {
                  // Render a new boundary next time, so it can recover from the error.
                  this.treeKey = nextTreeKey++;
                  reject(err);
                }}
                key={this.treeKey}
              >
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
