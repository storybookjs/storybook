import React, { Fragment, useState } from 'react';

import { IconButton } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';

import { ChevronSmallDownIcon } from '@storybook/icons';

import type { Result } from 'axe-core';

import type { RuleType } from '../A11YPanel';
import { Elements } from './Elements';
import { Info } from './Info';
import { Tags } from './Tags';

const Wrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const Icon = styled(ChevronSmallDownIcon)({
  transition: 'transform 0.1s ease-in-out',
});

const HeaderBar = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 5,
  paddingLeft: 15,
  minHeight: 40,
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  '&:hover': {
    color: theme.color.secondary,
  },
}));

interface ItemProps {
  item: Result;
  type: RuleType;
}

// export class Item extends Component<ItemProps, ItemState> {
export const Item = (props: ItemProps) => {
  const [open, onToggle] = useState(false);

  const { item, type } = props;

  return (
    <Wrapper>
      <HeaderBar onClick={() => onToggle(!open)} role="button">
        <strong>{item.help}</strong>
        <IconButton onClick={() => onToggle(!open)}>
          <Icon style={{ transform: `rotate(${open ? -180 : 0}deg)` }} />
        </IconButton>
      </HeaderBar>
      {open ? (
        <Fragment>
          <Info item={item} key="info" />
          <Elements elements={item.nodes} type={type} key="elements" />
          <Tags tags={item.tags} key="tags" />
        </Fragment>
      ) : null}
    </Wrapper>
  );
};
