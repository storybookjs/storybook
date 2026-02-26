import type { FC, PropsWithChildren, ReactElement, ReactNode } from 'react';
import React, { Children, useCallback, useContext, useMemo, useState } from 'react';

import { logger } from 'storybook/internal/client-logger';
import { Bar, Button, ToggleButton, Zoom } from 'storybook/internal/components';
import type { ActionItem } from 'storybook/internal/components';

import { CopyIcon, MarkupIcon } from '@storybook/icons';

import { useId } from '@react-aria/utils';
import { darken } from 'polished';
import { styled } from 'storybook/theming';

import type { SourceProps } from '.';
import { Source } from '.';
import { DocsContext } from '../blocks/DocsContext';
import { getStoryId } from '../blocks/Story';
import { getBlockBackgroundStyle } from './BlockBackgroundStyles';
import { StorySkeleton } from './Story';
import { Toolbar } from './Toolbar';
import { ZoomContext } from './ZoomContext';

export type PreviewProps = PropsWithChildren<{
  isLoading?: true;
  layout?: Layout;
  inline?: boolean;
  isColumn?: boolean;
  columns?: number;
  withSource?: SourceProps;
  isExpanded?: boolean;
  withToolbar?: boolean;
  className?: string;
  additionalActions?: ActionItem[];
}>;

export type Layout = 'padded' | 'fullscreen' | 'centered';

const ChildrenContainer = styled.div<PreviewProps & { layout: Layout }>(
  ({ isColumn, columns, layout }) => ({
    display: isColumn || !columns ? 'block' : 'flex',
    position: 'relative',
    flexWrap: 'wrap',
    overflow: 'auto',
    flexDirection: isColumn ? 'column' : 'row',

    '& .innerZoomElementWrapper > *': isColumn
      ? {
          width: layout !== 'fullscreen' ? 'calc(100% - 20px)' : '100%',
          display: 'block',
        }
      : {
          maxWidth: layout !== 'fullscreen' ? 'calc(100% - 20px)' : '100%',
          display: 'inline-block',
        },
  }),
  ({ layout = 'padded', inline }) =>
    layout === 'centered' || layout === 'padded'
      ? {
          padding: inline ? '32px 22px' : '0px',
          '& .innerZoomElementWrapper > *': {
            width: 'auto',
            border: '8px solid transparent!important',
          },
        }
      : {},
  ({ layout = 'padded', inline }) =>
    layout === 'centered' && inline
      ? {
          display: 'flex',
          justifyContent: 'center',
          justifyItems: 'center',
          alignContent: 'center',
          alignItems: 'center',
        }
      : {},
  ({ columns }) =>
    columns && columns > 1
      ? { '.innerZoomElementWrapper > *': { minWidth: `calc(100% / ${columns} - 20px)` } }
      : {}
);

const ActionBar = styled(Bar)({
  marginTop: -40,
});

const StyledSource = styled(Source)(({ theme }) => ({
  margin: 0,
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderBottomLeftRadius: theme.appBorderRadius,
  borderBottomRightRadius: theme.appBorderRadius,
  border: 'none',

  background:
    theme.base === 'light' ? 'rgba(0, 0, 0, 0.85)' : darken(0.05, theme.background.content),
  color: theme.color.lightest,
  button: {
    background:
      theme.base === 'light' ? 'rgba(0, 0, 0, 0.85)' : darken(0.05, theme.background.content),
  },
}));

const PreviewContainer = styled.div<PreviewProps>(
  ({ theme }) => ({
    position: 'relative',
    overflow: 'hidden',
    margin: '25px 0 40px',
    ...getBlockBackgroundStyle(theme),
    'h3 + &': {
      marginTop: '16px',
    },
  }),
  ({ withToolbar }) => withToolbar && { paddingTop: 40 }
);

function getChildProps(children: ReactNode) {
  if (Children.count(children) === 1) {
    const elt = children as ReactElement;
    if (elt.props) {
      return elt.props;
    }
  }
  return null;
}

const PositionedToolbar = styled(Toolbar)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 40,
});

const COPIED_LABEL_ANIMATION_DURATION = 2000;

/**
 * A preview component for showing one or more component `Story` items. The preview also shows the
 * source for the component as a drop-down.
 */
export const Preview: FC<PreviewProps> = ({
  isLoading,
  isColumn,
  columns,
  children,
  withSource,
  withToolbar = false,
  isExpanded = false,
  additionalActions,
  className,
  layout = 'padded',
  inline = false,
  ...props
}) => {
  const [expanded, setExpanded] = useState(isExpanded);
  const [copied, setCopied] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const additionalActionItems = useMemo(
    () => (additionalActions ? [...additionalActions] : []),
    [additionalActions]
  );
  const sourceId = useId();
  const previewClasses = [className].concat(['sbdocs', 'sbdocs-preview', 'sb-unstyled']);

  const context = useContext(DocsContext);

  const copyToClipboard = useCallback(async (text: string) => {
    const { createCopyToClipboardFunction } = await import('storybook/internal/components');
    await createCopyToClipboardFunction()(text);
  }, []);

  const handleCopyCode = useCallback(async () => {
    try {
      await copyToClipboard(withSource?.code ?? '');
      setCopied('Copied!');
    } catch (err) {
      logger.error(err);
      setCopied('Copy error!');
    }

    globalThis.window.setTimeout(() => setCopied(null), COPIED_LABEL_ANIMATION_DURATION);
  }, [copyToClipboard, withSource?.code]);

  const childProps = getChildProps(children);

  const hasSourceError = !!(withSource && withSource.error);
  const hasValidSource = !!(withSource && !withSource.error);

  return (
    <>
      <PreviewContainer
        {...{ withSource, withToolbar }}
        {...props}
        className={previewClasses.join(' ')}
      >
        {withToolbar && (
          <PositionedToolbar
            isLoading={isLoading}
            border
            zoom={(z: number) => setScale(scale * z)}
            resetZoom={() => setScale(1)}
            storyId={!isLoading && childProps ? getStoryId(childProps, context) : undefined}
          />
        )}
        <ZoomContext.Provider value={{ scale }}>
          <ChildrenContainer
            isColumn={isColumn || !Array.isArray(children)}
            columns={columns}
            layout={layout}
            inline={inline}
          >
            <Zoom.Element centered={layout === 'centered'} scale={inline ? scale : 1}>
              {Array.isArray(children) ? (
                children.map((child, i) => <div key={i}>{child}</div>)
              ) : (
                <div>{children}</div>
              )}
            </Zoom.Element>
          </ChildrenContainer>
        </ZoomContext.Provider>
        {hasValidSource && expanded && (
          <div id={sourceId}>
            <StyledSource {...withSource} dark copyable={false} />
          </div>
        )}
      </PreviewContainer>
      {(withSource || additionalActionItems.length > 0) && (
        <ActionBar className="sbdocs sbdocs-preview-actions" innerStyle={{ paddingInline: 0 }}>
          {hasSourceError && (
            <Button
              ariaLabel={false}
              disabled
              variant="ghost"
              className="docblock-code-toggle docblock-code-toggle--disabled"
            >
              <MarkupIcon /> No code available
            </Button>
          )}
          {hasValidSource && (
            <>
              <ToggleButton
                ariaLabel={false}
                pressed={expanded}
                aria-expanded={expanded}
                aria-controls={sourceId}
                onClick={() => setExpanded(!expanded)}
                variant="ghost"
                className={`docblock-code-toggle${expanded ? ' docblock-code-toggle--expanded' : ''}`}
              >
                <MarkupIcon /> {expanded ? 'Hide code' : 'Show code'}
              </ToggleButton>
              <Button ariaLabel={false} variant="ghost" onClick={handleCopyCode}>
                <CopyIcon /> {copied ?? 'Copy code'}
              </Button>
            </>
          )}
          {additionalActionItems.map(({ title, className, onClick, disabled }, index: number) => (
            <Button
              key={index}
              className={className}
              onClick={onClick}
              disabled={!!disabled}
              variant="ghost"
            >
              {title}
            </Button>
          ))}
        </ActionBar>
      )}
    </>
  );
};

const StyledPreview = styled(Preview)(() => ({
  '.docs-story': {
    paddingTop: 32,
    paddingBottom: 40,
  },
}));

export const PreviewSkeleton = () => (
  <StyledPreview isLoading withToolbar>
    <StorySkeleton />
  </StyledPreview>
);
