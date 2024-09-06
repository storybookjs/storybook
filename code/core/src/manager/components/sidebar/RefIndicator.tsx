import type { FC, MouseEventHandler } from 'react';
import React, { forwardRef, useCallback, useMemo } from 'react';

import type { TooltipLinkListLink } from '@storybook/core/components';
import { Spaced, TooltipLinkList, WithTooltip } from '@storybook/core/components';
import { styled, transparentize, useTheme } from '@storybook/core/theming';
import { global } from '@storybook/global';
import {
  AlertIcon,
  ChevronDownIcon,
  DocumentIcon,
  GlobeIcon,
  LightningIcon,
  LockIcon,
  MarkupIcon,
  TimeIcon,
} from '@storybook/icons';

import { useStorybookApi } from '@storybook/core/manager-api';

import type { getStateType } from '../../utils/tree';
import type { RefType } from './types';

const { document, window: globalWindow } = global;

export type ClickHandler = TooltipLinkListLink['onClick'];
export interface IndicatorIconProps {
  type: ReturnType<typeof getStateType>;
}
export interface CurrentVersionProps {
  url: string;
  versions: RefType['versions'];
}

const IndicatorPlacement = styled.aside(({ theme }) => ({
  height: 16,

  display: 'flex',
  alignItems: 'center',

  '& > * + *': {
    marginLeft: theme.layoutMargin,
  },
}));

const IndicatorClickTarget = styled.button(({ theme }) => ({
  height: 20,
  width: 20,
  padding: 0,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  outline: 'none',
  border: '1px solid transparent',
  borderRadius: '100%',
  cursor: 'pointer',
  color:
    theme.base === 'light'
      ? transparentize(0.3, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText),

  '&:hover': {
    color: theme.barSelectedColor,
  },
  '&:focus': {
    color: theme.barSelectedColor,
    borderColor: theme.color.secondary,
  },
  svg: {
    height: 10,
    width: 10,
    transition: 'all 150ms ease-out',
    color: 'inherit',
  },
}));

const MessageTitle = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const Message = styled.a(({ theme }) => ({
  textDecoration: 'none',
  lineHeight: '16px',
  padding: 15,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  color: theme.color.defaultText,
  '&:not(:last-child)': {
    borderBottom: `1px solid ${theme.appBorderColor}`,
  },
  '&:hover': {
    background: theme.background.hoverable,
    color: theme.color.darker,
  },
  '&:link': {
    color: theme.color.darker,
  },
  '&:active': {
    color: theme.color.darker,
  },
  '&:focus': {
    color: theme.color.darker,
  },
  '& > *': {
    flex: 1,
  },
  '& > svg': {
    marginTop: 3,
    width: 16,
    height: 16,
    marginRight: 10,
    flex: 'unset',
  },
}));

export const MessageWrapper = styled.div({
  width: 280,
  boxSizing: 'border-box',
  borderRadius: 8,
  overflow: 'hidden',
});

const Version = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.regular,
  color:
    theme.base === 'light'
      ? transparentize(0.3, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText),

  '& > * + *': {
    marginLeft: 4,
  },

  svg: {
    height: 10,
    width: 10,
  },
}));

const CurrentVersion: FC<CurrentVersionProps> = ({ url, versions }) => {
  const currentVersionId = useMemo(() => {
    // @ts-expect-error (non strict)
    const c = Object.entries(versions).find(([k, v]) => v === url);
    return c && c[0] ? c[0] : 'current';
  }, [url, versions]);

  return (
    <Version>
      <span>{currentVersionId}</span>
      <ChevronDownIcon />
    </Version>
  );
};

export const RefIndicator = React.memo(
  forwardRef<HTMLElement, RefType & { state: ReturnType<typeof getStateType> }>(
    ({ state, ...ref }, forwardedRef) => {
      const api = useStorybookApi();
      const list = useMemo(() => Object.values(ref.index || {}), [ref.index]);
      const componentCount = useMemo(
        () => list.filter((v) => v.type === 'component').length,
        [list]
      );
      const leafCount = useMemo(
        () => list.filter((v) => v.type === 'docs' || v.type === 'story').length,
        [list]
      );

      return (
        <IndicatorPlacement ref={forwardedRef}>
          <WithTooltip
            placement="bottom-start"
            trigger="click"
            closeOnOutsideClick
            tooltip={
              <MessageWrapper>
                <Spaced row={0}>
                  {state === 'loading' && <LoadingMessage url={ref.url} />}
                  {(state === 'error' || state === 'empty') && (
                    <ErrorOccurredMessage url={ref.url} />
                  )}
                  {state === 'ready' && (
                    <>
                      <ReadyMessage {...{ url: ref.url, componentCount, leafCount }} />
                      {ref.sourceUrl && <SourceCodeMessage url={ref.sourceUrl} />}
                    </>
                  )}
                  {state === 'auth' && <LoginRequiredMessage {...ref} />}
                  {ref.type === 'auto-inject' && state !== 'error' && (
                    <PerformanceDegradedMessage />
                  )}
                  {state !== 'loading' && <ReadDocsMessage />}
                </Spaced>
              </MessageWrapper>
            }
          >
            <IndicatorClickTarget data-action="toggle-indicator" aria-label="toggle indicator">
              <GlobeIcon />
            </IndicatorClickTarget>
          </WithTooltip>

          {ref.versions && Object.keys(ref.versions).length ? (
            <WithTooltip
              placement="bottom-start"
              trigger="click"
              closeOnOutsideClick
              tooltip={(tooltip) => (
                <TooltipLinkList
                  // @ts-expect-error (non strict)
                  links={Object.entries(ref.versions).map(([id, href]) => ({
                    icon: href === ref.url ? 'check' : undefined,
                    id,
                    title: id,
                    href,
                    onClick: (event, item) => {
                      event.preventDefault();
                      // @ts-expect-error (non strict)
                      api.changeRefVersion(ref.id, item.href);
                      tooltip.onHide();
                    },
                  }))}
                />
              )}
            >
              <CurrentVersion url={ref.url} versions={ref.versions} />
            </WithTooltip>
          ) : null}
        </IndicatorPlacement>
      );
    }
  )
);

const ReadyMessage: FC<{
  url: string;
  componentCount: number;
  leafCount: number;
}> = ({ url, componentCount, leafCount }) => {
  const theme = useTheme();

  return (
    <Message href={url.replace(/\/?$/, '/index.html')} target="_blank">
      <GlobeIcon color={theme.color.secondary} />
      <div>
        <MessageTitle>View external Storybook</MessageTitle>
        <div>
          Explore {componentCount} components and {leafCount} stories in a new browser tab.
        </div>
      </div>
    </Message>
  );
};

const SourceCodeMessage: FC<{
  url?: string;
}> = ({ url }) => {
  const theme = useTheme();

  return (
    <Message href={url} target="_blank">
      <MarkupIcon color={theme.color.secondary} />
      <div>
        <MessageTitle>View source code</MessageTitle>
      </div>
    </Message>
  );
};

const LoginRequiredMessage: FC<RefType> = ({ loginUrl, id }) => {
  const theme = useTheme();
  const open = useCallback<MouseEventHandler>((e) => {
    e.preventDefault();
    const childWindow = globalWindow.open(loginUrl, `storybook_auth_${id}`, 'resizable,scrollbars');

    // poll for window to close
    const timer = setInterval(() => {
      if (!childWindow) {
        clearInterval(timer);
      } else if (childWindow.closed) {
        clearInterval(timer);
        document.location.reload();
      }
    }, 1000);
  }, []);

  return (
    <Message onClick={open}>
      <LockIcon color={theme.color.gold} />
      <div>
        <MessageTitle>Log in required</MessageTitle>
        <div>You need to authenticate to view this Storybook's components.</div>
      </div>
    </Message>
  );
};

const ReadDocsMessage: FC = () => {
  const theme = useTheme();

  return (
    <Message
      href="https://storybook.js.org/docs/react/sharing/storybook-composition"
      target="_blank"
    >
      <DocumentIcon color={theme.color.green} />
      <div>
        <MessageTitle>Read Composition docs</MessageTitle>
        <div>Learn how to combine multiple Storybooks into one.</div>
      </div>
    </Message>
  );
};

const ErrorOccurredMessage: FC<{ url: string }> = ({ url }) => {
  const theme = useTheme();

  return (
    <Message href={url.replace(/\/?$/, '/index.html')} target="_blank">
      <AlertIcon color={theme.color.negative} />
      <div>
        <MessageTitle>Something went wrong</MessageTitle>
        <div>This external Storybook didn't load. Debug it in a new tab now.</div>
      </div>
    </Message>
  );
};

const LoadingMessage: FC<{ url: string }> = ({ url }) => {
  const theme = useTheme();

  return (
    <Message href={url.replace(/\/?$/, '/index.html')} target="_blank">
      <TimeIcon color={theme.color.secondary} />
      <div>
        <MessageTitle>Please wait</MessageTitle>
        <div>This Storybook is loading.</div>
      </div>
    </Message>
  );
};

const PerformanceDegradedMessage: FC = () => {
  const theme = useTheme();

  return (
    <Message
      href="https://storybook.js.org/docs/react/sharing/storybook-composition#improve-your-storybook-composition"
      target="_blank"
    >
      <LightningIcon color={theme.color.gold} />
      <div>
        <MessageTitle>Reduce lag</MessageTitle>
        <div>Learn how to speed up Composition performance.</div>
      </div>
    </Message>
  );
};
