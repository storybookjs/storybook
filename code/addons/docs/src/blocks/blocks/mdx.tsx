import type { FC, MouseEvent, PropsWithChildren, SyntheticEvent } from 'react';
import React, { useContext } from 'react';

import type { SupportedLanguage } from 'storybook/internal/components';
import { Button, Code, components, nameSpaceClassNames } from 'storybook/internal/components';
import { NAVIGATE_URL } from 'storybook/internal/core-events';

import { LinkIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { Source } from '../components';
import type { DocsContextProps } from './DocsContext';
import { DocsContext } from './DocsContext';

const { document } = globalThis;

// Hacky utility for asserting identifiers in MDX Story elements
export const assertIsFn = (val: any) => {
  if (typeof val !== 'function') {
    throw new Error(`Expected story function, got: ${val}`);
  }
  return val;
};

// Hacky utility for adding mdxStoryToId to the default context
export const AddContext: FC<PropsWithChildren<DocsContextProps>> = (props) => {
  const { children, ...rest } = props;
  const parentContext = React.useContext(DocsContext);
  return (
    <DocsContext.Provider value={{ ...parentContext, ...rest }}>{children}</DocsContext.Provider>
  );
};

interface CodeOrSourceMdxProps {
  className?: string;
}

export const CodeOrSourceMdx: FC<PropsWithChildren<CodeOrSourceMdxProps>> = ({
  className,
  children,
  ...rest
}) => {
  // markdown-to-jsx does not add className to inline code
  if (
    typeof className !== 'string' &&
    (typeof children !== 'string' || !(children as string).match(/[\n\r]/g))
  ) {
    return <Code>{children}</Code>;
  }
  // className: "lang-jsx"
  const language = className && className.split('-');
  return (
    <Source
      language={((language && language[1]) as SupportedLanguage) || 'text'}
      format={false}
      code={children as string}
      {...rest}
    />
  );
};

function navigate(context: DocsContextProps, url: string) {
  context.channel.emit(NAVIGATE_URL, url);
}

const A = components.a;

interface AnchorInPageProps {
  hash: string;
}

const AnchorInPage: FC<PropsWithChildren<AnchorInPageProps>> = ({ hash, children }) => {
  const context = useContext(DocsContext);

  return (
    <A
      href={hash}
      target="_self"
      onClick={(event: SyntheticEvent) => {
        const id = hash.substring(1);
        const element = document.getElementById(id);
        if (element) {
          navigate(context, hash);
        }
      }}
    >
      {children}
    </A>
  );
};

interface AnchorMdxProps {
  href: string;
  target: string;
}

export const AnchorMdx: FC<PropsWithChildren<AnchorMdxProps>> = (props) => {
  const { href, target, children, ...rest } = props;
  const context = useContext(DocsContext);

  // links to external locations don't need any modifications.
  if (!href || target === '_blank' || /^https?:\/\//.test(href)) {
    return <A {...props} />;
  }

  // Enable scrolling for in-page anchors.
  if (href.startsWith('#')) {
    return <AnchorInPage hash={href}>{children}</AnchorInPage>;
  }

  // Links to other pages of SB should use the base URL of the top level iframe instead of the base URL of the preview iframe.
  return (
    <A
      href={href}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        // Cmd/Ctrl/Shift/Alt + Click should trigger default browser behaviour. Same applies to non-left clicks
        const LEFT_BUTTON = 0;
        const isLeftClick =
          event.button === LEFT_BUTTON &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey;

        if (isLeftClick) {
          event.preventDefault();
          // use the A element's href, which has been modified for
          // local paths without a `?path=` query param prefix
          navigate(context, event.currentTarget.getAttribute('href') || '');
        }
      }}
      target={target}
      {...rest}
    >
      {children}
    </A>
  );
};

const SUPPORTED_MDX_HEADERS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

const OcticonHeaders = SUPPORTED_MDX_HEADERS.reduce(
  (acc, headerType) => ({
    ...acc,
    [headerType]: styled(headerType)({
      position: 'relative',
      '& svg': {
        position: 'relative',
        top: '-0.1em',
        visibility: 'hidden',
      },
      '&:hover svg, &:focus-within svg': {
        visibility: 'visible',
      },
    }),
  }),
  {}
);

const OcticonAnchorWrapper = styled.span({
  // Position the anchor in the heading's left gutter instead of floating it, so the
  // Button's dimensions never shift the heading text. The parent header is relatively
  // positioned to anchor this.
  position: 'absolute',
  top: 0,
  right: '100%',
  lineHeight: 'inherit',
  paddingRight: '10px',
  // Allow the theme's text color to override the default link color.
  color: 'inherit',
  '& a': {
    color: 'inherit',
    textDecoration: 'none',
  },
});

interface HeaderWithOcticonAnchorProps {
  as: string;
  id: string;
}

const HeaderWithOcticonAnchor: FC<PropsWithChildren<HeaderWithOcticonAnchorProps>> = ({
  as,
  id,
  children,
  ...rest
}) => {
  const context = useContext(DocsContext);

  // @ts-expect-error (Converted from ts-ignore)
  const OcticonHeader = OcticonHeaders[as];
  const hash = `#${id}`;

  return (
    <OcticonHeader id={id} {...rest}>
      <OcticonAnchorWrapper>
        <Button asChild variant="ghost" size="small" ariaLabel="Copy heading URL to address bar">
          <a
            href={hash}
            target="_self"
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault();
              const element = document.getElementById(id);
              if (element) {
                navigate(context, hash);
              }
            }}
          >
            <LinkIcon />
          </a>
        </Button>
      </OcticonAnchorWrapper>
      {children}
    </OcticonHeader>
  );
};

interface HeaderMdxProps {
  as: string;
  id: string;
}

export const HeaderMdx: FC<PropsWithChildren<HeaderMdxProps>> = (props) => {
  const { as, id, children, ...rest } = props;

  // An id should have been added on every header by the "remark-slug" plugin.
  if (id) {
    return (
      <HeaderWithOcticonAnchor as={as} id={id} {...rest}>
        {children}
      </HeaderWithOcticonAnchor>
    );
  }
  // Make sure it still work if "remark-slug" plugin is not present.
  const Component = as as React.ElementType;
  const { as: omittedAs, ...withoutAs } = props;
  return <Component {...nameSpaceClassNames(withoutAs, as)} />;
};

export const HeadersMdx = SUPPORTED_MDX_HEADERS.reduce(
  (acc, headerType) => ({
    ...acc,
    // @ts-expect-error (Converted from ts-ignore)
    [headerType]: (props: object) => <HeaderMdx as={headerType} {...props} />,
  }),
  {}
);
