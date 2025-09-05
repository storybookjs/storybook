import React, { useEffect, useId } from 'react';
import type { FC, ReactElement } from 'react';

import type { Channel } from 'storybook/internal/channels';
import { NAVIGATE_URL } from 'storybook/internal/core-events';

import { styled } from 'storybook/theming';
import tocbot from 'tocbot';

// Define our own interface based on tocbot's actual options
interface TocbotOptions {
  tocSelector: string;
  contentSelector: string;
  headingSelector: string;
  ignoreSelector?: string;
  headingsOffset?: number;
  scrollSmoothOffset?: number;
  orderedList?: boolean;
  onClick?: (e: MouseEvent) => void;
  scrollEndCallback?: () => void;
  [key: string]: unknown;
}

export interface TocParameters {
  /** CSS selector for the container to search for headings. */
  contentsSelector?: string;

  /**
   * When true, hide the TOC. We still show the empty container (as opposed to showing nothing at
   * all) because it affects the page layout and we want to preserve the layout across pages.
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
   *
   * @see tocbot docs {@link https://tscanlin.github.io/tocbot/#usage}
   */
  unsafeTocbotOptions?: Omit<TocbotOptions, 'onClick' | 'scrollEndCallback'>;
}

const Aside = styled.aside(() => ({
  width: '10rem',

  '@media (max-width: 768px)': {
    display: 'none',
  },
}));

const Nav = styled.nav(({ theme }) => ({
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
    channel: Channel;
  }
>;

const Title: FC<{
  headingId: string;
  title: TableOfContentsProps['title'];
}> = ({ headingId, title }) => {
  // General case.
  if (typeof title === 'string' || !title) {
    return (
      <Heading as="h2" id={headingId} className={title ? '' : 'sb-sr-only'}>
        {title || 'Table of contents'}
      </Heading>
    );
  }

  // Custom JSX title: we must ensure an ID is set for ARIA attributes to work.
  return <div id={headingId}>{title}</div>;
};

export const TableOfContents = ({
  title,
  disable,
  headingSelector,
  contentsSelector,
  ignoreSelector,
  unsafeTocbotOptions,
  channel,
  className,
}: TableOfContentsProps) => {
  useEffect(() => {
    // Do not initialize tocbot when we won't be rendering a ToC.
    if (disable) {
      return () => {};
    }

    const configuration = {
      tocSelector: '.toc-wrapper',
      contentSelector: contentsSelector ?? '.sbdocs-content',
      headingSelector: headingSelector ?? 'h3',
      /** Ignore headings that did not come from the main markdown code. */
      ignoreSelector: ignoreSelector ?? '.docs-story *, .skip-toc',
      headingsOffset: 40,
      scrollSmoothOffset: -40,
      orderedList: false,
      /** Prevent default linking behavior, leaving only the smooth scrolling. */
      onClick: (e: MouseEvent) => {
        e.preventDefault();
        if (e.currentTarget instanceof HTMLAnchorElement) {
          const [, headerId] = e.currentTarget.href.split('#');
          if (headerId) {
            channel.emit(NAVIGATE_URL, `#${headerId}`);
          }
        }
      },
      ...unsafeTocbotOptions,
    };

    /** Wait for the DOM to be ready. */
    const timeout = setTimeout(() => tocbot.init(configuration), 100);
    return () => {
      clearTimeout(timeout);
      tocbot.destroy();
    };
  }, [channel, disable, ignoreSelector, contentsSelector, headingSelector, unsafeTocbotOptions]);

  const headingId = useId();

  return (
    <Aside className={className}>
      {!disable ? (
        <Nav aria-labelledby={headingId}>
          <Title headingId={headingId} title={title} />
          <div className="toc-wrapper" />
        </Nav>
      ) : null}
    </Aside>
  );
};
