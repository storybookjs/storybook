import type { FC, MouseEventHandler, ReactNode } from 'react';
import React, { forwardRef, useCallback, useMemo } from 'react';

import { Button, PopoverProvider, Select, Spaced } from 'storybook/internal/components';

import { global } from '@storybook/global';
import {
  AlertIcon,
  DocumentIcon,
  GlobeIcon,
  LightningIcon,
  LockIcon,
  MarkupIcon,
  TimeIcon,
} from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled, useTheme } from 'storybook/theming';

import type { NormalLink } from '../../../components/components/tooltip/TooltipLinkList';
import type { getStateType } from '../../utils/tree';
import { useLayout } from '../layout/LayoutProvider';
import type { RefType } from './types';

const { document, window: globalWindow } = global;

export type ClickHandler = NormalLink['onClick'];
export interface IndicatorIconProps {
  type: ReturnType<typeof getStateType>;
}
export interface CurrentVersionProps {
  url: string;
  versions: RefType['versions'];
}

const IndicatorPlacement = styled.div(({ theme }) => ({
  height: 16,

  display: 'flex',
  alignItems: 'center',

  '& > * + *': {
    marginLeft: theme.layoutMargin,
  },
}));

const IndicatorClickTarget = styled(Button)(({ theme }) => ({
  color: theme.textMutedColor,
  svg: {
    height: 14,
    width: 14,
    padding: 2,
    transition: 'all 150ms ease-out',
    color: 'inherit',
  },
}));

const MessageTitle = styled.span(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

const StyledMessage = styled.a(({ theme }) => ({
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
    color: theme.color.defaultText,
  },
  '&:link, &:active, &:focus': {
    color: theme.color.defaultText,
  },
  '&:focus-visible': {
    background: theme.background.hoverable,
    borderRadius: 8,
    boxShadow: `inset 0 0 0 2px ${theme.color.secondary}`,
    outline: 'none',
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

const Message: FC<{
  blank?: boolean;
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler;
}> = ({ href, blank = true, children, onClick }) => {
  return (
    <StyledMessage href={href} target={blank ? '_blank' : undefined} onClick={onClick}>
      {children}
    </StyledMessage>
  );
};

export const MessageWrapper = styled.div<{
  isMobile: boolean;
}>(
  ({ isMobile }) => ({
    width: isMobile ? 'calc(100vw - 20px)' : 280,
    boxSizing: 'border-box',
    borderRadius: 8,
    overflow: 'hidden',
  }),
  ({ theme }) => ({
    color: theme.color.dark,
  })
);

const SubtleSelect = styled(Select)(({ theme }) => ({
  background: 'transparent',
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,
  fontWeight: theme.typography.weight.regular,
}));

export const RefIndicator = React.memo(
  forwardRef<HTMLElement, RefType & { state: ReturnType<typeof getStateType> }>(
    ({ state, ...ref }, forwardedRef) => {
      const api = useStorybookApi();
      const { isMobile } = useLayout();
      const list = useMemo(() => Object.values(ref.index || {}), [ref.index]);
      const componentCount = useMemo(
        () => list.filter((v) => v.type === 'component').length,
        [list]
      );
      const leafCount = useMemo(
        () => list.filter((v) => v.type === 'docs' || v.type === 'story').length,
        [list]
      );

      const currentVersion = useMemo(() => {
        if (ref.versions) {
          return Object.entries(ref.versions).find(([, v]) => v === ref.url)?.[0];
        }
        return undefined;
      }, [ref.versions, ref.url]);

      return (
        <IndicatorPlacement ref={forwardedRef}>
          <PopoverProvider
            placement={isMobile ? 'bottom' : 'bottom-start'}
            padding={0}
            popover={() => (
              <MessageWrapper isMobile={isMobile}>
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
            )}
          >
            <IndicatorClickTarget
              variant="ghost"
              padding="small"
              size="small"
              data-action="toggle-indicator"
              ariaLabel="Extra actions"
            >
              <GlobeIcon />
            </IndicatorClickTarget>
          </PopoverProvider>

          {ref.versions && Object.keys(ref.versions).length ? (
            <>
              <SubtleSelect
                padding="small"
                size="small"
                ariaLabel="Version"
                tooltip="Choose version"
                defaultOptions={currentVersion}
                onSelect={(item) => {
                  // We only pass strings as version ids, so item is always a string
                  const href = ref.versions?.[item as string];
                  if (href) {
                    api.changeRefVersion(ref.id, href);
                  }
                }}
                options={Object.entries(ref.versions).map(([id, href]) => ({
                  value: id,
                  title: id,
                  href,
                }))}
              >
                version
              </SubtleSelect>
            </>
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
    <Message href={url.replace(/\/?$/, '/index.html')}>
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
    <Message href={url}>
      <MarkupIcon color={theme.color.secondary} />
      <div>
        <MessageTitle>View source code</MessageTitle>
      </div>
    </Message>
  );
};

const LoginRequiredMessage: FC<RefType> = ({ loginUrl, id }) => {
  const theme = useTheme();
  const open = useCallback<MouseEventHandler>(
    (e) => {
      e.preventDefault();
      const childWindow = globalWindow.open(
        loginUrl,
        `storybook_auth_${id}`,
        'resizable,scrollbars'
      );

      // poll for window to close
      const timer = setInterval(() => {
        if (!childWindow) {
          clearInterval(timer);
        } else if (childWindow.closed) {
          clearInterval(timer);
          document.location.reload();
        }
      }, 1000);
    },
    [id, loginUrl]
  );

  return (
    <Message onClick={open} blank={false}>
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
    <Message href="https://storybook.js.org/docs/sharing/storybook-composition?ref=ui">
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
    <Message href={url.replace(/\/?$/, '/index.html')}>
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
    <Message href={url.replace(/\/?$/, '/index.html')}>
      <TimeIcon color={theme.color.secondary} />
      <div>
        <MessageTitle>Please wait</MessageTitle>
        <div>This Storybook is loading.</div>
      </div>
    </Message>
  );
};

// TODO: This is a temporary fix as the documentation link is not available with the 8.0 release, since the features it referenced were removed. See https://storybook.js.org/docs/7/sharing/storybook-composition#improve-your-storybook-composition for context.
const PerformanceDegradedMessage: FC = () => {
  const theme = useTheme();

  return (
    <Message href="https://storybook.js.org/docs/sharing/storybook-composition?ref=ui">
      <LightningIcon color={theme.color.gold} />
      <div>
        <MessageTitle>Reduce lag</MessageTitle>
        <div>Learn how to speed up Composition performance.</div>
      </div>
    </Message>
  );
};
