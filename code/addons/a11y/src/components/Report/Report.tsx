import type { FC } from 'react';
import React from 'react';

import { EmptyTabContent, IconButton } from 'storybook/internal/components';

import { ChevronSmallDownIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { getTitleForAxeResult } from '../../axeRuleMappingHelper';
import type { EnhancedResult, RuleType } from '../../types';
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

const Count = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.textMutedColor,
  width: 28,
  height: 28,
}));

export interface ReportProps {
  items: EnhancedResult[];
  empty: string;
  type: RuleType;
  handleSelectionChange: (key: string) => void;
  selectedItems: Map<EnhancedResult['id'], string>;
  toggleOpen: (event: React.SyntheticEvent<Element>, type: RuleType, item: EnhancedResult) => void;
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
        const detailsId = `details:${id}`;
        const selection = selectedItems.get(id);
        const title = getTitleForAxeResult(item);
        return (
          <Wrapper key={id}>
            <HeaderBar onClick={(event) => toggleOpen(event, type, item)} data-active={!!selection}>
              <Title>
                <strong>{title}</strong>
              </Title>
              <Count>{item.nodes.length}</Count>
              <IconButton
                onClick={(event) => toggleOpen(event, type, item)}
                aria-label={`${selection ? 'Collapse' : 'Expand'} details for ${title}`}
                aria-expanded={!!selection}
                aria-controls={detailsId}
              >
                <Icon style={{ transform: `rotate(${selection ? -180 : 0}deg)` }} />
              </IconButton>
            </HeaderBar>
            {selection ? (
              <Details
                id={detailsId}
                item={item}
                type={type}
                selection={selection}
                handleSelectionChange={handleSelectionChange}
              />
            ) : (
              <div id={detailsId} />
            )}
          </Wrapper>
        );
      })
    ) : (
      <EmptyTabContent title={empty} />
    )}
  </>
);
