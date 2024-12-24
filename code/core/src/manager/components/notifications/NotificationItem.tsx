import type { FC, SyntheticEvent } from 'react';
import React, { useCallback, useEffect, useRef } from 'react';

import type { IconsProps } from '@storybook/core/components';
import { IconButton, Icons } from '@storybook/core/components';
import { Link } from '@storybook/core/router';
import { keyframes, styled, useTheme } from '@storybook/core/theming';
import { CloseAltIcon } from '@storybook/icons';

import { type State } from '@storybook/core/manager-api';

import { transparentize } from 'polished';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';

const slideIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(30px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const grow = keyframes({
  '0%': {
    width: '0%',
  },
  '100%': {
    width: '100%',
  },
});

const Notification = styled.div<{ duration?: number }>(
  ({ theme }) => ({
    position: 'relative',
    display: 'flex',
    border: `1px solid ${theme.appBorderColor}`,
    padding: '12px 6px 12px 12px',
    borderRadius: theme.appBorderRadius + 1,
    alignItems: 'center',

    animation: `${slideIn} 500ms`,
    background: theme.base === 'light' ? 'hsla(203, 50%, 20%, .97)' : 'hsla(203, 30%, 95%, .97)',
    boxShadow: `0 2px 5px 0 rgba(0, 0, 0, 0.05), 0 5px 15px 0 rgba(0, 0, 0, 0.1)`,
    color: theme.color.inverseText,
    textDecoration: 'none',
    overflow: 'hidden',

    [MEDIA_DESKTOP_BREAKPOINT]: {
      boxShadow: `0 1px 2px 0 rgba(0, 0, 0, 0.05), 0px -5px 20px 10px ${theme.background.app}`,
    },
  }),
  ({ duration, theme }) =>
    duration && {
      '&::after': {
        content: '""',
        display: 'block',
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 3,
        background: theme.color.secondary,
        animation: `${grow} ${duration}ms linear forwards reverse`,
      },
    }
);

const NotificationWithInteractiveStates = styled(Notification)({
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  textAlign: 'left',
  transition: 'all 150ms ease-out',
  transform: 'translate3d(0, 0, 0)',
  '&:hover': {
    transform: 'translate3d(0, -3px, 0)',
    boxShadow:
      '0 1px 3px 0 rgba(30,167,253,0.5), 0 2px 5px 0 rgba(0,0,0,0.05), 0 5px 15px 0 rgba(0,0,0,0.1)',
  },
  '&:active': {
    transform: 'translate3d(0, 0, 0)',
    boxShadow:
      '0 1px 3px 0 rgba(30,167,253,0.5), 0 2px 5px 0 rgba(0,0,0,0.05), 0 5px 15px 0 rgba(0,0,0,0.1)',
  },
  '&:focus': {
    boxShadow:
      'rgba(2,156,253,1) 0 0 0 1px inset, 0 1px 3px 0 rgba(30,167,253,0.5), 0 2px 5px 0 rgba(0,0,0,0.05), 0 5px 15px 0 rgba(0,0,0,0.1)',
  },
});
const NotificationButton = NotificationWithInteractiveStates.withComponent('div');
const NotificationLink = NotificationWithInteractiveStates.withComponent(Link);

const NotificationIconWrapper = styled.div(() => ({
  display: 'flex',
  marginRight: 10,
  alignItems: 'center',

  svg: {
    width: 16,
    height: 16,
  },
}));

const NotificationTextWrapper = styled.div(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  color: theme.base === 'dark' ? theme.color.mediumdark : theme.color.mediumlight,
}));

const Headline = styled.div<{ hasIcon: boolean }>(({ theme, hasIcon }) => ({
  height: '100%',
  alignItems: 'center',
  whiteSpace: 'balance',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: theme.typography.size.s1,
  lineHeight: '16px',
  fontWeight: theme.typography.weight.bold,
}));

const SubHeadline = styled.div(({ theme }) => ({
  color: transparentize(0.25, theme.color.inverseText),
  fontSize: theme.typography.size.s1 - 1,
  lineHeight: '14px',
  marginTop: 2,
  whiteSpace: 'balance',
}));

const ItemContent: FC<Pick<State['notifications'][0], 'icon' | 'content'>> = ({
  icon,
  content: { headline, subHeadline },
}) => {
  const theme = useTheme();
  const defaultColor = theme.base === 'dark' ? theme.color.mediumdark : theme.color.mediumlight;

  return (
    <>
      {!icon || (
        <NotificationIconWrapper>
          {React.isValidElement(icon)
            ? icon
            : typeof icon === 'object' &&
              'name' in icon && (
                <Icons icon={icon.name as IconsProps['icon']} color={icon.color || defaultColor} />
              )}
        </NotificationIconWrapper>
      )}
      <NotificationTextWrapper>
        <Headline title={headline} hasIcon={!!icon}>
          {headline}
        </Headline>
        {subHeadline && <SubHeadline>{subHeadline}</SubHeadline>}
      </NotificationTextWrapper>
    </>
  );
};

const DismissButtonWrapper = styled(IconButton)(({ theme }) => ({
  width: 28,
  alignSelf: 'center',
  marginTop: 0,
  color: theme.base === 'light' ? 'rgba(255,255,255,0.7)' : ' #999999',
}));

const DismissNotificationItem: FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => (
  <DismissButtonWrapper
    title="Dismiss notification"
    onClick={(e: SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    }}
  >
    <CloseAltIcon size={12} />
  </DismissButtonWrapper>
);

export const NotificationItemSpacer = styled.div({
  height: 48,
});

const NotificationItem: FC<{
  notification: State['notifications'][0];
  onDismissNotification: (id: string) => void;
  zIndex?: number;
}> = ({
  notification: { content, duration, link, onClear, onClick, id, icon },
  onDismissNotification,
  zIndex,
}) => {
  const onTimeout = useCallback(() => {
    onDismissNotification(id);

    if (onClear) {
      onClear({ dismissed: false, timeout: true });
    }
  }, [id, onDismissNotification, onClear]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!duration) {
      return;
    }
    timer.current = setTimeout(onTimeout, duration);
    // @ts-expect-error (non strict)
    return () => clearTimeout(timer.current);
  }, [duration, onTimeout]);

  const onDismiss = useCallback(() => {
    // @ts-expect-error (non strict)
    clearTimeout(timer.current);
    onDismissNotification(id);

    if (onClear) {
      onClear({ dismissed: true, timeout: false });
    }
  }, [id, onDismissNotification, onClear]);

  if (link) {
    return (
      <NotificationLink to={link} duration={duration} style={{ zIndex }}>
        <ItemContent icon={icon} content={content} />
        <DismissNotificationItem onDismiss={onDismiss} />
      </NotificationLink>
    );
  }

  if (onClick) {
    return (
      <NotificationButton
        duration={duration}
        onClick={() => onClick({ onDismiss })}
        style={{ zIndex }}
      >
        <ItemContent icon={icon} content={content} />
        <DismissNotificationItem onDismiss={onDismiss} />
      </NotificationButton>
    );
  }

  return (
    <Notification duration={duration} style={{ zIndex }}>
      <ItemContent icon={icon} content={content} />
      <DismissNotificationItem onDismiss={onDismiss} />
    </Notification>
  );
};

export default NotificationItem;
