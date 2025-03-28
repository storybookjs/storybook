import type { FC } from 'react';
import React from 'react';

import { Badge, EmptyTabContent, IconButton } from 'storybook/internal/components';

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
  containerType: 'inline-size',
}));

const Icon = styled(ChevronSmallDownIcon)({
  transition: 'transform 0.1s ease-in-out',
});

const HeaderBar = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px 6px 15px',
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

const Title = styled.div({
  display: 'flex',
  flexGrow: 1,
  gap: 6,
});

const RuleId = styled.div(({ theme }) => ({
  display: 'none',
  color: theme.textMutedColor,

  '@container (min-width: 800px)': {
    display: 'block',
  },
}));

const Count = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 28,
  height: 28,
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
              onClick={(event) => toggleOpen(event, type, item)}
              role="button"
              data-active={!!selection}
            >
              <Title>
                <strong>{item.help}</strong>
                <RuleId>{item.id}</RuleId>
              </Title>
              <Count>{item.nodes.length}</Count>
              <IconButton onClick={(event) => toggleOpen(event, type, item)}>
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
