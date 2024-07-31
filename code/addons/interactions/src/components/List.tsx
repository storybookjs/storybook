import React, { Fragment, useState } from 'react';
import { styled, themes, convert } from 'storybook/internal/theming';
import { ChevronSmallDownIcon } from '@storybook/icons';

const ListWrapper = styled.ul({
  listStyle: 'none',
  fontSize: 14,
  padding: 0,
  margin: 0,
});

const Wrapper = styled.div({
  display: 'flex',
  width: '100%',
  borderBottom: `1px solid ${convert(themes.light).appBorderColor}`,
  '&:hover': {
    background: convert(themes.light).background.hoverable,
  },
});

const Icon = styled(ChevronSmallDownIcon)({
  color: convert(themes.light).textMutedColor,
  marginRight: 10,
  transition: 'transform 0.1s ease-in-out',
  alignSelf: 'center',
  display: 'inline-flex',
});

const HeaderBar = styled.div({
  padding: convert(themes.light).layoutMargin,
  paddingLeft: convert(themes.light).layoutMargin - 3,
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  borderLeft: '3px solid transparent',
  width: '100%',

  '&:focus': {
    outline: '0 none',
    borderLeft: `3px solid ${convert(themes.light).color.secondary}`,
  },
});

const Description = styled.div({
  padding: convert(themes.light).layoutMargin,
  marginBottom: convert(themes.light).layoutMargin,
  fontStyle: 'italic',
});

type Item = {
  title: string;
  description: string;
};

interface ListItemProps {
  item: Item;
}

export const ListItem: React.FC<ListItemProps> = ({ item }) => {
  const [open, onToggle] = useState(false);

  return (
    <Fragment>
      <Wrapper>
        <HeaderBar onClick={() => onToggle(!open)} role="button">
          <Icon
            color={convert(themes.light).appBorderColor}
            style={{
              transform: `rotate(${open ? 0 : -90}deg)`,
            }}
          />
          {item.title}
        </HeaderBar>
      </Wrapper>
      {open ? <Description>{item.description}</Description> : null}
    </Fragment>
  );
};

interface ListProps {
  items: Item[];
}

export const List: React.FC<ListProps> = ({ items }) => (
  <ListWrapper>
    {items.map((item) => (
      <ListItem key={item.title + item.description} item={item} />
    ))}
  </ListWrapper>
);
