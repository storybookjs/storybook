import React from 'react';

import { darken, transparentize } from 'polished';
import { styled } from 'storybook/theming';

const BadgeWrapper = styled.div<BadgeProps>(
  ({ theme, compact }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.size.s1,
    fontWeight: theme.typography.weight.bold,
    lineHeight: '12px',
    minWidth: 20,
    borderRadius: 20,
    padding: compact ? '4px 7px' : '4px 10px',
  }),
  {
    svg: {
      height: 12,
      width: 12,
      marginRight: 4,
      marginTop: -2,

      path: {
        fill: 'currentColor',
      },
    },
  },
  ({ theme, status }) => {
    switch (status) {
      case 'critical': {
        return {
          color: theme.fgColor.critical,
          background: theme.bgColor.critical,
          boxShadow: `inset 0 0 0 1px ${theme.borderColor.critical}`,
        };
      }
      case 'negative': {
        return {
          color: theme.fgColor.negative,
          background: theme.bgColor.negative,
          boxShadow: `inset 0 0 0 1px ${theme.borderColor.negative}`,
        };
      }
      case 'warning': {
        return {
          color: theme.fgColor.warning,
          background: theme.bgColor.warning,
          boxShadow: `inset 0 0 0 1px ${theme.borderColor.warning}`,
        };
      }
      case 'neutral': {
        return {
          color: theme.fgColor.muted,
          background: theme.base === 'dark' ? theme.barBg : theme.background.app,
          boxShadow: `inset 0 0 0 1px ${transparentize(0.8, theme.textMutedColor)}`,
        };
      }
      case 'positive': {
        return {
          color: theme.fgColor.positive,
          background: theme.bgColor.positive,
          boxShadow: `inset 0 0 0 1px ${theme.borderColor.positive}`,
        };
      }
      case 'active': {
        return {
          color:
            theme.base === 'light' ? darken(0.1, theme.color.secondary) : theme.color.secondary,
          background: theme.background.hoverable,
          boxShadow: `inset 0 0 0 1px ${transparentize(0.9, theme.color.secondary)}`,
        };
      }
      default: {
        return {};
      }
    }
  }
);

export interface BadgeProps {
  compact?: boolean;
  status?: 'positive' | 'negative' | 'neutral' | 'warning' | 'critical' | 'active';
  children?: React.ReactNode;
}

export const Badge = ({ ...props }: BadgeProps) => {
  return <BadgeWrapper {...props} />;
};
