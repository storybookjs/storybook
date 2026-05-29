import React from 'react';
import type { ComponentType, PropsWithChildren } from 'react';

import type { Parameters, Renderer } from 'storybook/internal/types';

import type { Theme } from 'storybook/theming';

import { DocsContainer } from './DocsContainer';
import type { DocsContextProps } from './DocsContext';
import { DocsPage } from './DocsPage';

export type DocsProps<TRenderer extends Renderer = Renderer> = {
  docsParameter: Parameters;
  context: DocsContextProps<TRenderer>;
};

export function Docs<TRenderer extends Renderer = Renderer>({
  context,
  docsParameter,
}: DocsProps<TRenderer>) {
  const Container: ComponentType<
    PropsWithChildren<{ context: DocsContextProps<TRenderer>; theme: Theme }>
  > = docsParameter.container || DocsContainer;

  const Page = docsParameter.page || DocsPage;

  // `context` is a DocsContext class instance, so we set the flag on it directly rather than
  // spreading into a new object (which would drop its prototype methods). A custom `page`
  // (MDX-compiled or user-defined) opts out of `autodocs`-tag filtering.
  context.filterByAutodocs = !docsParameter.page;

  return (
    <Container context={context} theme={docsParameter.theme}>
      <Page />
    </Container>
  );
}
