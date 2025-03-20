import type { FC } from 'react';
import React from 'react';

import { EmptyTabContent, IconButton } from 'storybook/internal/components';

import { ChevronSmallDownIcon } from '@storybook/icons';

import type { Result } from 'axe-core';
import { styled } from 'storybook/theming';

import type { RuleType } from '../../types';
import { Details } from './Details';

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

export interface ReportProps {
  items: Result[];
  empty: string;
  type: RuleType;
  handleSelectionChange: (key: string) => void;
  selectedItems: Map<Result['id'], string>;
  toggleOpen: (event: React.SyntheticEvent<Element>, type: RuleType, item: Result) => void;
}

export const Report: FC<ReportProps> = ({
  items,
  empty,
  type,
  handleSelectionChange,
  selectedItems,
  toggleOpen,
}) => (
  <>
    {items && items.length ? (
      items.map((item) => {
        const id = `${type}.${item.id}`;
        const selection = selectedItems.get(id);
        return (
          <Wrapper key={id}>
            <HeaderBar
              onClick={(e) => toggleOpen(e, type, item)}
              role="button"
              data-active={!!selection}
            >
              <strong>{item.help}</strong>
              <IconButton onClick={(ev) => toggleOpen(ev, type, item)}>
                <Icon style={{ transform: `rotate(${selection ? -180 : 0}deg)` }} />
              </IconButton>
            </HeaderBar>
            {selection ? (
              <Details
                item={item}
                type={type}
                selection={selection}
                handleSelectionChange={handleSelectionChange}
              />
            ) : null}
          </Wrapper>
        );
      })
    ) : (
      <EmptyTabContent title={empty} />
    )}
  </>
);
