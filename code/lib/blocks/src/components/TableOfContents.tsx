import React, { useEffect } from 'react';
import type { FC, ReactElement } from 'react';
import { styled } from 'storybook/internal/theming';
import * as tocbot from 'tocbot';

export interface TocParameters {
  /** CSS selector for the container to search for headings. */
  contentsSelector?: string;

  /**
   * When true, hide the TOC. We still show the empty container
   * (as opposed to showing nothing at all) because it affects the
   * page layout and we want to preserve the layout across pages.
   */
  disable?: boolean;

  /** CSS selector to match headings to list in the TOC. */
  headingSelector?: string;

  /** Headings that match the ignoreSelector will be skipped. */
  ignoreSelector?: string;

  /** Custom title ReactElement or string to display above the TOC. */
  title?: ReactElement | string | null;

  /**
   * TocBot options, not guaranteed to be available in future versions.
   * @see tocbot docs {@link https://tscanlin.github.io/tocbot/#usage}
   */
  unsafeTocbotOptions?: tocbot.IStaticOptions;
}

const Wrapper = styled.div(({ theme }) => ({
  width: '10rem',

  '@media (max-width: 768px)': {
    display: 'none',
  },
}));

const Content = styled.div(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  top: 0,
  width: '10rem',
  paddingTop: '4rem',
  paddingBottom: '2rem',
  overflowY: 'auto',

  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s2,

  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  WebkitTapHighlightColor: 'rgba(0, 0, 0, 0)',
  WebkitOverflowScrolling: 'touch',

  '& *': {
    boxSizing: 'border-box',
  },

  '& > .toc-wrapper > .toc-list': {
    paddingLeft: 0,
    borderLeft: `solid 2px ${theme.color.mediumlight}`,

    '.toc-list': {
      paddingLeft: 0,
      borderLeft: `solid 2px ${theme.color.mediumlight}`,

      '.toc-list': {
        paddingLeft: 0,
        borderLeft: `solid 2px ${theme.color.mediumlight}`,
      },
    },
  },
  '& .toc-list-item': {
    position: 'relative',
    listStyleType: 'none',
    marginLeft: 20,
    paddingTop: 3,
    paddingBottom: 3,
  },
  '& .toc-list-item::before': {
    content: '""',
    position: 'absolute',
    height: '100%',
    top: 0,
    left: 0,
    transform: `translateX(calc(-2px - 20px))`,
    borderLeft: `solid 2px ${theme.color.mediumdark}`,
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  '& .toc-list-item.is-active-li::before': {
    opacity: 1,
  },
  '& .toc-list-item > a': {
    color: theme.color.defaultText,
    textDecoration: 'none',
  },
  '& .toc-list-item.is-active-li > a': {
    fontWeight: 600,
    color: theme.color.secondary,
    textDecoration: 'none',
  },
}));

const Heading = styled.p(({ theme }) => ({
  fontWeight: 600,
  fontSize: '0.875em',
  color: theme.textColor,
  textTransform: 'uppercase',
  marginBottom: 10,
}));

type TableOfContentsProps = React.PropsWithChildren<
  TocParameters & {
    className?: string;
  }
>;

const OptionalTitle: FC<{ title: TableOfContentsProps['title'] }> = ({ title }) => {
  if (title === null) {
    return null;
  }
  if (typeof title === 'string') {
    return <Heading>{title}</Heading>;
  }
  return title;
};

export const TableOfContents = ({
  title,
  disable,
  headingSelector,
  contentsSelector,
  ignoreSelector,
  unsafeTocbotOptions,
}: TableOfContentsProps) => {
  useEffect(() => {
    const configuration = {
      tocSelector: '.toc-wrapper',
      contentSelector: contentsSelector ?? '.sbdocs-content',
      headingSelector: headingSelector ?? 'h3',
      /**
       * Ignore headings that did not
       * come from the main markdown code.
       */
      ignoreSelector: ignoreSelector ?? '.docs-story *, .skip-toc',
      headingsOffset: 40,
      scrollSmoothOffset: -40,
      orderedList: false,
      /**
       * Prevent default linking behavior,
       * leaving only the smooth scrolling.
       */
      onClick: () => false,
      ...unsafeTocbotOptions,
    };

    /**
     * Wait for the DOM to be ready.
     */
    const timeout = setTimeout(() => tocbot.init(configuration), 100);
    return () => {
      clearTimeout(timeout);
      tocbot.destroy();
    };
  }, [disable]);

  return (
    <>
      <Wrapper>
        {!disable ? (
          <Content>
            <OptionalTitle title={title || null} />
            <div className="toc-wrapper" />
          </Content>
        ) : null}
      </Wrapper>
    </>
  );
};
