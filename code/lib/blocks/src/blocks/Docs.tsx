import React from 'react';
import type { ComponentType, PropsWithChildren } from 'react';

import type { Theme } from 'storybook/internal/theming';
import type { Parameters, Renderer } from 'storybook/internal/types';

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

  return (
    <Container context={context} theme={docsParameter.theme}>
      <Page />
    </Container>
  );
}
