import type { ComponentProps, FC } from 'react';
import React, { useState } from 'react';

import { ActionsList, Button, PopoverProvider, ToggleButton } from 'storybook/internal/components';

import { CloseIcon, CogIcon } from '@storybook/icons';

import { transparentize } from 'polished';
import { type Theme, css, styled } from 'storybook/theming';

import type { useMenu } from '../../container/Menu';
import { useLayout } from '../layout/LayoutProvider';

export type MenuList = ReturnType<typeof useMenu>;

const buttonStyleAdditions = ({
  highlighted,
  isMobile,
  theme,
}: {
  highlighted: boolean;
  isMobile: boolean;
  theme: Theme;
}) => css`
  position: relative;
  overflow: visible;
  margin-top: 0;
  z-index: 1;
  ${isMobile &&
  `
    width: 36px;
    height: 36px;
  `}
  ${highlighted &&
  `
    &:before,
    &:after {
      content: '';
      position: absolute;
      top: 6px;
      right: 6px;
      width: 5px;
      height: 5px;
      z-index: 2;
      border-radius: 50%;
      background: ${theme.background.app};
      border: 1px solid ${theme.background.app};
      box-shadow: 0 0 0 2px ${theme.background.app};
    }
    &:after {
      background: ${theme.color.positive};
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 0 0 2px ${theme.background.app};
    }
    &:hover:after,
    &:focus-visible:after {
      box-shadow: 0 0 0 2px ${transparentize(0.88, theme.color.secondary)};
    }
  `}
`;

const Container = styled.div({
  minWidth: 250,
});

export const SidebarButton = styled(Button)<
  ComponentProps<typeof Button> & {
    highlighted: boolean;
    isMobile: boolean;
  }
>(buttonStyleAdditions);

export const SidebarToggleButton = styled(ToggleButton)<
  ComponentProps<typeof ToggleButton> & {
    highlighted: boolean;
    isMobile: boolean;
  }
>(buttonStyleAdditions);

const MenuButtonGroup = styled.div({
  display: 'flex',
  gap: 6,
});

const SidebarMenuList: FC<{
  menu: MenuList;
  onHide: () => void;
}> = ({ menu, onHide }) => (
  <Container>
    {menu
      .filter((links) => links.length)
      .flatMap((links) => (
        <ActionsList as="ul" key={links.map((link) => link.id).join('_')}>
          {links.map((link) => (
            <ActionsList.Item as="li" key={link.id} active={link.active}>
              <ActionsList.Action
                {...(link.href && { as: 'a', href: link.href, target: '_blank' })}
                ariaLabel={false}
                id={`list-item-${link.id}`}
                disabled={link.disabled}
                onClick={(e) => {
                  if (link.disabled) {
                    e.preventDefault();
                    return;
                  }
                  link.onClick?.(e, {
                    id: link.id,
                    active: link.active,
                    disabled: link.disabled,
                    title: link.title,
                    href: link.href,
                  });
                  if (link.closeOnClick) {
                    onHide();
                  }
                }}
              >
                {(link.icon || link.input) && (
                  <ActionsList.Icon>{link.icon || link.input}</ActionsList.Icon>
                )}
                {(link.title || link.center) && (
                  <ActionsList.Text>{link.title || link.center}</ActionsList.Text>
                )}
                {link.right}
              </ActionsList.Action>
            </ActionsList.Item>
          ))}
        </ActionsList>
      ))}
  </Container>
);

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
        <SidebarButton
          padding="small"
          variant="ghost"
          ariaLabel="About Storybook"
          highlighted={!!isHighlighted}
          onClick={onClick}
          isMobile={true}
        >
          <CogIcon />
        </SidebarButton>
        <SidebarButton
          padding="small"
          variant="ghost"
          ariaLabel="Close menu"
          highlighted={false}
          onClick={() => setMobileMenuOpen(false)}
          isMobile={true}
        >
          <CloseIcon />
        </SidebarButton>
      </MenuButtonGroup>
    );
  }

  return (
    <PopoverProvider
      placement={'bottom-start'}
      padding={0}
      popover={({ onHide }) => <SidebarMenuList onHide={onHide} menu={menu} />}
      onVisibleChange={setIsTooltipVisible}
    >
      <SidebarToggleButton
        ariaLabel="Settings"
        pressed={isTooltipVisible}
        highlighted={!!isHighlighted}
        padding="small"
        variant="ghost"
        size="medium"
        isMobile={false}
      >
        <CogIcon />
      </SidebarToggleButton>
    </PopoverProvider>
  );
};
