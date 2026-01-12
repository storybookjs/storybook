import React from 'react';

import { darken, transparentize } from 'polished';
import { styled } from 'storybook/theming';

const BadgeWrapper = styled.div<BadgeProps>(
  ({ compact }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `var(--sb-typography-size-s1)`,
    fontWeight: 'var(--sb-typography-weight-bold)',
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
          color: 'var(--sb-fgColor-critical)',
          background: 'var(--sb-bgColor-critical)',
          boxShadow: `inset 0 0 0 1px var(--sb-borderColor-critical)`,
        };
      }
      case 'negative': {
        return {
          color: 'var(--sb-fgColor-negative)',
          background: 'var(--sb-bgColor-negative)',
          boxShadow: `inset 0 0 0 1px var(--sb-borderColor-negative)`,
        };
      }
      case 'warning': {
        return {
          color: 'var(--sb-fgColor-warning)',
          background: 'var(--sb-bgColor-warning)',
          boxShadow: `inset 0 0 0 1px var(--sb-borderColor-warning)`,
        };
      }
      case 'neutral': {
        return {
          color: 'var(--sb-fgColor-muted)',
          background: theme.base === 'dark' ? 'var(--sb-barBg)' : 'var(--sb-background-app)',
          boxShadow: `inset 0 0 0 1px ${transparentize(0.8, theme.textMutedColor)}`,
        };
      }
      case 'positive': {
        return {
          color: 'var(--sb-fgColor-positive)',
          background: 'var(--sb-bgColor-positive)',
          boxShadow: `inset 0 0 0 1px var(--sb-borderColor-positive)`,
        };
      }
      case 'active': {
        return {
          color:
            theme.base === 'light'
              ? darken(0.1, theme.color.secondary)
              : 'var(--sb-color-secondary)',
          background: 'var(--sb-background-hoverable)',
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
