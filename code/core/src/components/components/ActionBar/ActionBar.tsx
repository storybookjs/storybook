import type { MouseEvent, ReactElement } from 'react';
import React from 'react';

import { styled } from '@storybook/core/theming';

const Container = styled.div(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  right: 0,
  maxWidth: '100%',
  display: 'flex',
  background: theme.background.content,
  zIndex: 1,
}));

export const ActionButton = styled.button<{ disabled: boolean }>(
  ({ theme }) => ({
    margin: 0,
    border: '0 none',
    padding: '4px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',

    color: theme.color.defaultText,
    background: theme.background.content,

    fontSize: 12,
    lineHeight: '16px',
    fontFamily: theme.typography.fonts.base,
    fontWeight: theme.typography.weight.bold,

    borderTop: `1px solid ${theme.appBorderColor}`,
    borderLeft: `1px solid ${theme.appBorderColor}`,
    marginLeft: -1,

    borderRadius: `4px 0 0 0`,

    '&:not(:last-child)': { borderRight: `1px solid ${theme.appBorderColor}` },
    '& + *': {
      borderLeft: `1px solid ${theme.appBorderColor}`,
      borderRadius: 0,
    },

    '&:focus': {
      boxShadow: `${theme.color.secondary} 0 -3px 0 0 inset`,
      outline: '0 none',

      '@media (forced-colors: active)': {
        outline: '1px solid highlight',
      },
    },
  }),
  ({ disabled }) =>
    disabled && {
      cursor: 'not-allowed',
      opacity: 0.5,
    }
);
ActionButton.displayName = 'ActionButton';

export interface ActionItem {
  title: string | ReactElement;
  className?: string;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export interface ActionBarProps {
  actionItems: ActionItem[];
}

export const ActionBar = ({ actionItems, ...props }: ActionBarProps) => (
  <Container {...props}>
    {actionItems.map(({ title, className, onClick, disabled }, index: number) => (
      <ActionButton key={index} className={className} onClick={onClick} disabled={!!disabled}>
        {title}
      </ActionButton>
    ))}
  </Container>
);
