import type { FC, PropsWithChildren } from 'react';
import React, { useEffect } from 'react';

import type { Renderer } from 'storybook/internal/types';

import type { ThemeVars } from 'storybook/theming';
import { ThemeProvider, ensure as ensureTheme } from 'storybook/theming';

import { DocsPageWrapper } from '../components';
import { TableOfContents } from '../components/TableOfContents';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';
import { SourceContainer } from './SourceContainer';
import { scrollToElement } from './utils';

const { document, window: globalWindow } = globalThis;

export interface DocsContainerProps<TFramework extends Renderer = Renderer> {
  context: DocsContextProps<TFramework>;
  theme?: ThemeVars;
}

export const DocsContainer: FC<PropsWithChildren<DocsContainerProps>> = ({
  context,
  theme,
  children,
}) => {
  let toc;
  let meta;

  try {
    meta = context.resolveOf('meta', ['meta']);
    toc = meta.preparedMeta.parameters?.docs?.toc;
  } catch (err) {
    // No meta, falling back to project annotations
    toc = context?.projectAnnotations?.parameters?.docs?.toc;
  }

  useEffect(() => {
    let url;
    try {
      url = new URL(globalWindow.parent.location.toString());
      if (url.hash) {
        const element = document.getElementById(decodeURIComponent(url.hash.substring(1)));
        if (element) {
          // Introducing a delay to ensure scrolling works when it's a full refresh.
          setTimeout(() => {
            scrollToElement(element);
          }, 200);
        }
      }
    } catch (err) {
      // pass
    }
  });

  // It's not possible to disable toc in unattached MDX files, so we make it possible
  // to globally disable the toc for only those files in preview.ts. We use lack of
  // resolved meta to determine if the file is unattached.
  const shouldDisableMdx = toc?.disableUnattachedMdx && !meta;
  const tocComponent =
    toc && !shouldDisableMdx ? (
      <TableOfContents className="sbdocs sbdocs-toc--custom" channel={context.channel} {...toc} />
    ) : null;

  return (
    <DocsContext.Provider value={context}>
      <SourceContainer channel={context.channel}>
        <ThemeProvider theme={ensureTheme(theme as ThemeVars)}>
          <DocsPageWrapper toc={tocComponent}>{children}</DocsPageWrapper>
        </ThemeProvider>
      </SourceContainer>
    </DocsContext.Provider>
  );
};
