import React from 'react';

import { styled, transparentize } from '@storybook/core/theming';

const BadgeWrapper = styled.div<BadgeProps>(
  ({ theme }) => ({
    display: 'inline-block',
    fontSize: 11,
    lineHeight: '12px',
    alignSelf: 'center',
    padding: '4px 12px',
    borderRadius: '3em',
    fontWeight: theme.typography.weight.bold,
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
          color: theme.color.critical,
          background: theme.background.critical,
        };
      }
      case 'negative': {
        return {
          color: theme.color.negativeText,
          background: theme.background.negative,
          boxShadow:
            theme.base === 'light'
              ? `inset 0 0 0 1px ${transparentize(0.9, theme.color.negativeText)}`
              : 'none',
        };
      }
      case 'warning': {
        return {
          color: theme.color.warningText,
          background: theme.background.warning,
          boxShadow:
            theme.base === 'light'
              ? `inset 0 0 0 1px ${transparentize(0.9, theme.color.warningText)}`
              : 'none',
        };
      }
      case 'neutral': {
        return {
          color: theme.color.dark,
          background: theme.color.mediumlight,
          boxShadow:
            theme.base === 'light'
              ? `inset 0 0 0 1px ${transparentize(0.9, theme.color.dark)}`
              : 'none',
        };
      }
      case 'positive': {
        return {
          color: theme.color.positiveText,
          background: theme.background.positive,
          boxShadow:
            theme.base === 'light'
              ? `inset 0 0 0 1px ${transparentize(0.9, theme.color.positiveText)}`
              : 'none',
        };
      }
      default: {
        return {};
      }
    }
  }
);

export interface BadgeProps {
  status?: 'positive' | 'negative' | 'neutral' | 'warning' | 'critical';
  children?: React.ReactNode;
}

export const Badge = ({ ...props }: BadgeProps) => {
  return <BadgeWrapper {...props} />;
};
