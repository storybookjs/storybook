import type { ComponentProps, FC } from 'react';
import React from 'react';

import { Button } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import type { Addon_SidebarTopType } from '@storybook/core/types';

import { Brand } from './Brand';
import type { MenuList, SidebarMenuProps } from './Menu';
import { SidebarMenu } from './Menu';

export interface HeadingProps {
  menuHighlighted?: boolean;
  menu: MenuList;
  extra: Addon_SidebarTopType[];
  skipLinkHref?: string;
  isLoading: boolean;
  onMenuClick?: SidebarMenuProps['onClick'];
}

const BrandArea = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.defaultText,
  marginRight: 20,
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  minHeight: 22,

  '& > * > *': {
    maxWidth: '100%',
  },
  '& > *': {
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
    flex: '1 1 auto',
  },
}));

const HeadingWrapper = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'relative',
  minHeight: 42,
  paddingLeft: 8,
});

const SkipToCanvasLink = styled(Button)(({ theme }) => ({
  display: 'none',
  '@media (min-width: 600px)': {
    display: 'block',
    position: 'absolute',
    fontSize: theme.typography.size.s1,
    zIndex: 3,
    border: 0,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    wordWrap: 'normal',
    opacity: 0,
    transition: 'opacity 150ms ease-out',
    '&:focus': {
      width: '100%',
      height: 'inherit',
      padding: '10px 15px',
      margin: 0,
      clip: 'unset',
      overflow: 'unset',
      opacity: 1,
    },
  },
}));

export const Heading: FC<HeadingProps & ComponentProps<typeof HeadingWrapper>> = ({
  menuHighlighted = false,
  menu,
  skipLinkHref,
  extra,
  isLoading,
  onMenuClick,
  ...props
}) => {
  return (
    <HeadingWrapper {...props}>
      {skipLinkHref && (
        <SkipToCanvasLink asChild>
          <a href={skipLinkHref} tabIndex={0}>
            Skip to canvas
          </a>
        </SkipToCanvasLink>
      )}

      <BrandArea>
        <Brand />
      </BrandArea>

      {isLoading ? null : extra.map(({ id, render: Render }) => <Render key={id} />)}
      <SidebarMenu menu={menu} isHighlighted={menuHighlighted} onClick={onMenuClick} />
    </HeadingWrapper>
  );
};
