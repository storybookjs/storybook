import type { FunctionComponent } from 'react';
import React from 'react';

import { ResetWrapper } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { getBlockBackgroundStyle } from './BlockBackgroundStyles';

const ItemLabel = styled.div(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
  fontSize: theme.typography.size.s1,
  color: theme.color.defaultText,
  marginLeft: 10,
  lineHeight: 1.2,

  display: '-webkit-box',
  overflow: 'hidden',
  wordBreak: 'break-word',
  textOverflow: 'ellipsis',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
}));

const ItemSpecimen = styled.div(({ theme }) => ({
  ...getBlockBackgroundStyle(theme),
  overflow: 'hidden',
  height: 40,
  width: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',

  '> img, > svg': {
    width: 20,
    height: 20,
  },
}));

const Item = styled.div({
  display: 'inline-flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: '100%',
});

const List = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gridGap: '8px 16px',
  gridAutoFlow: 'row dense',
  gridAutoRows: 50,
});

interface IconItemProps {
  name: string;
  children?: React.ReactNode;
}

/** An individual icon with a caption and an example (passed as `children`). */
export const IconItem: FunctionComponent<IconItemProps> = ({ name, children }) => (
  <Item>
    <ItemSpecimen>{children}</ItemSpecimen>
    <ItemLabel>{name}</ItemLabel>
  </Item>
);

interface IconGalleryProps {
  children?: React.ReactNode;
}

/** Show a grid of icons, as specified by `IconItem`. */
export const IconGallery: FunctionComponent<IconGalleryProps> = ({ children, ...props }) => (
  <ResetWrapper>
    <List {...props} className="docblock-icongallery sb-unstyled">
      {children}
    </List>
  </ResetWrapper>
);
