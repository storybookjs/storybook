import type { FC } from 'react';
import React, { Fragment, useCallback, useState } from 'react';

import { logger } from 'storybook/internal/client-logger';
import {
  Button,
  ErrorFormatter,
  Link,
  PopoverProvider,
  Spaced,
} from 'storybook/internal/components';

import { global } from '@storybook/global';
import { ChevronDownIcon, LockIcon, SyncIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { useLayout } from '../layout/LayoutProvider';
import { Contained, Loader } from './Loader';
import { NoResults } from './NoResults';

const { window: globalWindow } = global;

const TextStyle = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  lineHeight: '20px',
  margin: 0,
}));
const Text = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  lineHeight: '20px',
  margin: 0,

  code: {
    fontSize: theme.typography.size.s1,
  },

  ul: {
    paddingLeft: 20,
    marginTop: 8,
    marginBottom: 8,
  },
}));

const ErrorDisplay = styled.pre<{ isMobile: boolean }>(
  {
    boxSizing: 'border-box',
    borderRadius: 8,
    overflow: 'auto',
    whiteSpace: 'pre',
  },
  ({ isMobile }) =>
    isMobile
      ? {
          maxWidth: 'calc(100vw - 40px)',
        }
      : {
          minWidth: 420,
          maxWidth: 640,
        },
  ({ theme }) => ({
    color: theme.color.dark,
  })
);

export const AuthBlock: FC<{ loginUrl: string; id: string }> = ({ loginUrl, id }) => {
  const [isAuthAttempted, setAuthAttempted] = useState(false);

  const refresh = useCallback(() => {
    globalWindow.document.location.reload();
  }, []);

  const open = useCallback<React.MouseEventHandler>((e) => {
    e.preventDefault();
    const childWindow = globalWindow.open(loginUrl, `storybook_auth_${id}`, 'resizable,scrollbars');

    // poll for window to close
    const timer = setInterval(() => {
      if (!childWindow) {
        logger.error('unable to access loginUrl window');
        clearInterval(timer);
      } else if (childWindow.closed) {
        clearInterval(timer);
        setAuthAttempted(true);
      }
    }, 1000);
  }, []);

  return (
    <Contained>
      <Spaced>
        {isAuthAttempted ? (
          <Fragment>
            <Text>
              Authentication on <strong>{loginUrl}</strong> concluded. Refresh the page to fetch
              this Storybook.
            </Text>
            <div>
              <Button ariaLabel={false} size="small" variant="outline" onClick={refresh}>
                <SyncIcon />
                Refresh now
              </Button>
            </div>
          </Fragment>
        ) : (
          <Fragment>
            <Text>Sign in to browse this Storybook.</Text>
            <div>
              {/* @ts-expect-error (non strict) */}
              <Button size="small" variant="outline" onClick={open}>
                <LockIcon />
                Sign in
              </Button>
            </div>
          </Fragment>
        )}
      </Spaced>
    </Contained>
  );
};

export const ErrorBlock: FC<{ error: Error }> = ({ error }) => {
  const { isMobile } = useLayout();
  return (
    <Contained>
      <Spaced>
        <TextStyle>
          Oh no! Something went wrong loading this Storybook.
          <br />
          <PopoverProvider
            hasCloseButton
            offset={isMobile ? 0 : 8}
            placement={isMobile ? 'bottom-end' : 'bottom-start'}
            popover={
              <ErrorDisplay isMobile={isMobile}>
                <ErrorFormatter error={error} />
              </ErrorDisplay>
            }
          >
            <Link isButton>
              View error <ChevronDownIcon />
            </Link>
          </PopoverProvider>{' '}
          <Link href="https://storybook.js.org/docs?ref=ui" cancel={false} target="_blank">
            View docs
          </Link>
        </TextStyle>
      </Spaced>
    </Contained>
  );
};

const FlexSpaced = styled(Spaced)({
  display: 'flex',
});
const WideSpaced = styled(Spaced)({
  flex: 1,
});

export const EmptyBlock = ({ isMain, hasEntries }: { isMain: boolean; hasEntries: boolean }) => (
  <Contained>
    <FlexSpaced col={1}>
      <WideSpaced>
        {hasEntries ? (
          <NoResults>
            <strong>No stories found</strong>
            <small>Your selected filters did not match any stories.</small>
          </NoResults>
        ) : isMain ? (
          <Text>
            Oh no! Your Storybook is empty. This can happen when:
            <ul>
              <li>
                Your{' '}
                <Link
                  href="https://storybook.js.org/docs/api/main-config/main-config-stories?ref=ui"
                  cancel={false}
                  target="_blank"
                >
                  stories glob configuration
                </Link>{' '}
                does not match any files.{' '}
              </li>
              <li>
                You have{' '}
                <Link
                  href="https://storybook.js.org/docs/writing-stories?ref=ui"
                  cancel={false}
                  target="_blank"
                >
                  no stories defined
                </Link>{' '}
                in your story files.{' '}
              </li>
            </ul>
          </Text>
        ) : (
          <Text>
            This composed Storybook is empty. Perhaps no stories match your selected filters.
          </Text>
        )}
      </WideSpaced>
    </FlexSpaced>
  </Contained>
);

export const LoaderBlock: FC<{ isMain: boolean }> = ({ isMain }) => (
  <Contained>
    <Loader size={isMain ? 17 : 5} />
  </Contained>
);
