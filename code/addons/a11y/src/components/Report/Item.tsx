import React, { Fragment, useState } from 'react';

import { styled } from 'storybook/internal/theming';

import type { Result } from 'axe-core';
import { Info } from './Info';

import { Elements } from './Elements';
import { Tags } from './Tags';

import type { RuleType } from '../A11YPanel';
import HighlightToggle from './HighlightToggle';
import { ChevronSmallDownIcon } from '@storybook/icons';

const Wrapper = styled.div(({ theme }) => ({
  display: 'flex',
  width: '100%',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  '&:hover': {
    background: theme.background.hoverable,
  },
}));

const Icon = styled(ChevronSmallDownIcon)({
  marginRight: 10,
  transition: 'transform 0.1s ease-in-out',
  verticalAlign: 'inherit',
});

const HeaderBar = styled.div(({ theme }) => ({
  padding: theme.layoutMargin,
  paddingLeft: theme.layoutMargin - 3,
  lineHeight: '20px',
  background: 'none',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  borderLeft: '3px solid transparent',
  width: '100%',

  '&:focus': {
    outline: '0 none',
    borderLeft: `3px solid ${theme.color.secondary}`,
  },
}));

const HighlightToggleElement = styled.span({
  fontWeight: 'normal',
  float: 'right',
  marginRight: 15,
  alignSelf: 'center',
  input: {
    margin: 0,
    display: 'block',
  },
});

interface ItemProps {
  item: Result;
  type: RuleType;
}

// export class Item extends Component<ItemProps, ItemState> {
export const Item = (props: ItemProps) => {
  const [open, onToggle] = useState(false);

  const { item, type } = props;
  const highlightToggleId = `${type}-${item.id}`;

  return (
    <Fragment>
      <Wrapper>
        <HeaderBar onClick={() => onToggle(!open)} role="button">
          <Icon
            style={{
              transform: `rotate(${open ? 0 : -90}deg)`,
            }}
          />
          {item.help}
        </HeaderBar>
        <HighlightToggleElement>
          <HighlightToggle toggleId={highlightToggleId} elementsToHighlight={item.nodes} />
        </HighlightToggleElement>
      </Wrapper>
      {open ? (
        <Fragment>
          <Info item={item} key="info" />
          <Elements elements={item.nodes} type={type} key="elements" />
          <Tags tags={item.tags} key="tags" />
        </Fragment>
      ) : null}
    </Fragment>
  );
};
