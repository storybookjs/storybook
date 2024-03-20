import type { FC, SyntheticEvent } from 'react';
import React from 'react';
import { type State } from '@storybook/manager-api';
import { Link } from '@storybook/router';
import { styled, useTheme } from '@storybook/theming';
import type { IconsProps } from '@storybook/components';
import { IconButton, Icons } from '@storybook/components';
import { transparentize } from 'polished';
import { CloseAltIcon } from '@storybook/icons';

const Notification = styled.div(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  padding: 15,
  width: 280,
  borderRadius: 4,
  alignItems: 'center',

  background: theme.base === 'light' ? 'hsla(203, 50%, 20%, .97)' : 'hsla(203, 30%, 95%, .97)',
  boxShadow: `0 2px 5px 0 rgba(0,0,0,0.05), 0 5px 15px 0 rgba(0,0,0,0.1)`,
  color: theme.color.inverseText,
  textDecoration: 'none',
}));

const NotificationWithInteractiveStates = styled(Notification)(() => ({
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
      '0 1px 3px 0 rgba(30,167,253,0.5), 0 2px 5px 0 rgba(0,0,0,0.05), 0 5px 15px 0 rgba(0,0,0,0.1)',
  },
}));
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
  width: hasIcon ? 205 : 230,
  alignItems: 'center',
  whiteSpace: 'nowrap',
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
}> = ({ notification: { content, link, onClear, id, icon }, onDismissNotification }) => {
  const dismissNotificationItem = () => {
    onDismissNotification(id);
    if (onClear) {
      onClear({ dismissed: true });
    }
  };
  return link ? (
    <NotificationLink to={link}>
      <ItemContent icon={icon} content={content} />
      <DismissNotificationItem onDismiss={dismissNotificationItem} />
    </NotificationLink>
  ) : (
    <Notification>
      <ItemContent icon={icon} content={content} />
      <DismissNotificationItem onDismiss={dismissNotificationItem} />
    </Notification>
  );
};

export default NotificationItem;
