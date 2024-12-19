import type { ComponentProps, FC } from 'react';
import React, { useState } from 'react';

import type { Button } from '@storybook/core/components';
import { IconButton, TooltipLinkList, WithTooltip } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { CloseIcon, CogIcon } from '@storybook/icons';

import { transparentize } from 'polished';

import type { useMenu } from '../../container/Menu';
import { useLayout } from '../layout/LayoutProvider';

export type MenuList = ReturnType<typeof useMenu>;

export const SidebarIconButton: FC<ComponentProps<typeof Button> & { highlighted: boolean }> =
  styled(IconButton)<
    ComponentProps<typeof Button> & {
      highlighted: boolean;
    }
  >(({ highlighted, theme }) => ({
    position: 'relative',
    overflow: 'visible',
    marginTop: 0,
    zIndex: 1,

    ...(highlighted && {
      '&:before, &:after': {
        content: '""',
        position: 'absolute',
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        zIndex: 2,
        borderRadius: '50%',
        background: theme.background.app,
        border: `1px solid ${theme.background.app}`,
        boxShadow: `0 0 0 2px ${theme.background.app}`,
      },
      '&:after': {
        background: theme.color.positive,
        border: `1px solid rgba(0, 0, 0, 0.1)`,
        boxShadow: `0 0 0 2px ${theme.background.app}`,
      },

      '&:hover:after, &:focus-visible:after': {
        boxShadow: `0 0 0 2px ${transparentize(0.88, theme.color.secondary)}`,
      },
    }),
  }));

const MenuButtonGroup = styled.div({
  display: 'flex',
  gap: 4,
});

const SidebarMenuList: FC<{
  menu: MenuList;
  onClick: () => void;
}> = ({ menu, onClick }) => {
  return <TooltipLinkList links={menu} onClick={onClick} />;
};

export interface SidebarMenuProps {
  menu: MenuList;
  isHighlighted?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const SidebarMenu: FC<SidebarMenuProps> = ({ menu, isHighlighted, onClick }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const { isMobile, setMobileMenuOpen } = useLayout();

  if (isMobile) {
    return (
      <MenuButtonGroup>
        <SidebarIconButton
          title="About Storybook"
          aria-label="About Storybook"
          // @ts-expect-error (non strict)
          highlighted={isHighlighted}
          active={false}
          // @ts-expect-error (non strict)
          onClick={onClick}
        >
          <CogIcon />
        </SidebarIconButton>
        <IconButton
          title="Close menu"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <CloseIcon />
        </IconButton>
      </MenuButtonGroup>
    );
  }

  return (
    <WithTooltip
      placement="top"
      closeOnOutsideClick
      tooltip={({ onHide }) => <SidebarMenuList onClick={onHide} menu={menu} />}
      onVisibleChange={setIsTooltipVisible}
    >
      <SidebarIconButton
        title="Shortcuts"
        aria-label="Shortcuts"
        // @ts-expect-error (non strict)
        highlighted={isHighlighted}
        active={isTooltipVisible}
      >
        <CogIcon />
      </SidebarIconButton>
    </WithTooltip>
  );
};
