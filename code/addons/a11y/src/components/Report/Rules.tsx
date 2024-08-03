import type { FC } from 'react';
import React from 'react';
import { styled } from 'storybook/internal/theming';
import { Badge } from 'storybook/internal/components';
import type { CheckResult } from 'axe-core';
import { useResizeDetector } from 'react-resize-detector';

const List = styled.div({
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: 4,
  paddingRight: 4,
  paddingTop: 4,
  fontWeight: 400,
});

const Item = styled.div<{ elementWidth: number }>(({ elementWidth }) => {
  const maxWidthBeforeBreak = 407;
  return {
    flexDirection: elementWidth > maxWidthBeforeBreak ? 'row' : 'inherit',
    marginBottom: elementWidth > maxWidthBeforeBreak ? 6 : 12,
    display: elementWidth > maxWidthBeforeBreak ? 'flex' : 'block',
  };
});

const StyledBadge = styled(Badge)({
  padding: '2px 8px',
  marginBottom: 3,
  minWidth: 65,
  maxWidth: 'fit-content',
  width: '100%',
  textAlign: 'center',
});

const Message = styled.div({
  paddingLeft: 6,
  paddingRight: 23,
});

export enum ImpactValue {
  MINOR = 'minor',
  MODERATE = 'moderate',
  SERIOUS = 'serious',
  CRITICAL = 'critical',
}

interface RuleProps {
  rule: CheckResult;
}

const formatSeverityText = (severity: string) => {
  return severity.charAt(0).toUpperCase().concat(severity.slice(1));
};

const Rule: FC<RuleProps> = ({ rule }) => {
  const { ref, width } = useResizeDetector({
    refreshMode: 'debounce',
    handleHeight: false,
    handleWidth: true,
  });
  let badgeType: any = null;
  switch (rule.impact) {
    case ImpactValue.CRITICAL:
      badgeType = 'critical';
      break;
    case ImpactValue.SERIOUS:
      badgeType = 'negative';
      break;
    case ImpactValue.MODERATE:
      badgeType = 'warning';
      break;
    case ImpactValue.MINOR:
      badgeType = 'neutral';
      break;
    default:
      break;
  }
  return (
    <Item ref={ref} elementWidth={width || 0}>
      <StyledBadge status={badgeType}>{formatSeverityText(rule.impact)}</StyledBadge>
      <Message>{rule.message}</Message>
    </Item>
  );
};

interface RulesProps {
  rules: CheckResult[];
}

export const Rules: FC<RulesProps> = ({ rules }) => {
  return (
    <List>
      {rules.map((rule, index) => (
        <Rule rule={rule} key={index} />
      ))}
    </List>
  );
};
