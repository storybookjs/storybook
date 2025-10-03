import type { ComponentProps, FC } from 'react';
import React from 'react';

import { Badge, Button, EmptyTabContent } from 'storybook/internal/components';

import { ChevronSmallDownIcon } from '@storybook/icons';

import type { ImpactValue } from 'axe-core';
import { styled } from 'storybook/theming';

import { getTitleForAxeResult } from '../../axeRuleMappingHelper';
import { type EnhancedResult, RuleType } from '../../types';
import { Details } from './Details';

const impactStatus: Record<NonNullable<ImpactValue>, ComponentProps<typeof Badge>['status']> = {
  minor: 'neutral',
  moderate: 'warning',
  serious: 'negative',
  critical: 'critical',
};

const impactLabels: Record<NonNullable<ImpactValue>, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  serious: 'Serious',
  critical: 'Critical',
};

const Wrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  borderBottom: `1px solid ${theme.appBorderColor}`,
  containerType: 'inline-size',
  fontSize: theme.typography.size.s2,
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

const Title = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  flexGrow: 1,
  fontSize: theme.typography.size.s2,
  gap: 8,
}));

const RuleId = styled.div(({ theme }) => ({
  display: 'none',
  color: theme.textMutedColor,
  fontFamily: theme.typography.fonts.mono,
  fontSize: theme.typography.size.s1,

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
                <RuleId>{item.id}</RuleId>
              </Title>
              {item.impact && (
                <Badge status={type === RuleType.PASS ? 'neutral' : impactStatus[item.impact]}>
                  {impactLabels[item.impact]}
                </Badge>
              )}
              <Count>{item.nodes.length}</Count>
              <Button
                onClick={(event) => toggleOpen(event, type, item)}
                ariaLabel={`${selection ? 'Collapse' : 'Expand'} details for: ${title}`}
                aria-expanded={!!selection}
                aria-controls={detailsId}
                variant="ghost"
                padding="small"
              >
                <Icon style={{ transform: `rotate(${selection ? -180 : 0}deg)` }} />
              </Button>
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
