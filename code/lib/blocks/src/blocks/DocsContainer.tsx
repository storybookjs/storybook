import React, { useEffect, useRef } from 'react';

import { ThemeProvider, ensure as ensureTheme } from 'storybook/internal/theming';

import { DocsPageWrapper } from '../components';
import { TableOfContents } from '../components/TableOfContents';
import { DocsContext } from './DocsContext';
import { SourceContainer } from './SourceContainer';
import { scrollToElement } from './utils';

const { window: globalWindow } = globalThis;

export interface DocsContainerProps<TFramework extends Renderer = Renderer> {
  context: DocsContextProps<TFramework>;
  theme?: ThemeVars;
}

export const DocsContainer: FC<PropsWithChildren<DocsContainerProps>> = ({
  context,
  theme,
  children,
}) => {
  const tocRef = useRef<HTMLDivElement | null>(null);

  let toc;
  try {
    const meta = context.resolveOf('meta', ['meta']);
    toc = meta.preparedMeta.parameters?.docs?.toc;
  } catch (err) {
    toc = context?.projectAnnotations?.parameters?.docs?.toc;
  }

  useEffect(() => {
    let url;
    try {
      url = new URL(globalWindow.parent.location.toString());
      if (url.hash) {
        const element = document.getElementById(decodeURIComponent(url.hash.substring(1)));
        if (element && tocRef.current) {
          scrollToElement(element);
        }
      }
    } catch (err) {
      // pass
    }
  }, [context]);

  return (
    <DocsContext.Provider value={context}>
      <SourceContainer channel={context.channel}>
        <ThemeProvider theme={ensureTheme(theme)}>
          <DocsPageWrapper
            toc={toc ? <TableOfContents className="sbdocs sbdocs-toc--custom" {...toc} /> : null}
          >
            {children}
          </DocsPageWrapper>
        </ThemeProvider>
      </SourceContainer>
    </DocsContext.Provider>
  );
};
