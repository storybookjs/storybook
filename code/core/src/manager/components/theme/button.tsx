import { FaceHappyIcon } from '@storybook/icons';
import type { FC } from 'react';
import React from 'react';
import { styled } from '@storybook/theming';
import { cssVar, readableColor, tint } from 'polished';

const ButtonStyled = styled.div<{ variant: 'outline' | 'ghost'; isBackgroundWhite: boolean }>(
  ({ variant, isBackgroundWhite }) => ({
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    padding: '0 8px',
    borderRadius: 4,
    transition: 'all 0.2s',
    cursor: 'pointer',
    fontSize: 14,
    color: readableColor(
      cssVar('--sb-background', '#fff') as string,
      'rgba(0, 0, 0, 0.6)',
      'rgba(255, 255, 255, 0.8)'
    ),

    border:
      variant === 'outline'
        ? `1px solid ${readableColor(
            cssVar('--sb-background', '#fff') as string,
            'rgba(0, 0, 0, 0.16)',
            'rgba(255, 255, 255, 0.4)'
          )}`
        : 'none',

    '&:hover': {
      color: isBackgroundWhite
        ? 'var(--sb-accent)'
        : readableColor(cssVar('--sb-background', '#fff') as string),
      background: isBackgroundWhite
        ? tint(0.94, cssVar('--sb-accent', '#fff') as string)
        : readableColor(
            cssVar('--sb-background', '#fff') as string,
            tint(0.3, cssVar('--sb-background', '#fff') as string),
            tint(0.2, cssVar('--sb-background', '#fff') as string),
            false
          ),
      border:
        variant === 'outline' ? `1px solid ${tint(0.6, cssVar('--sb-accent') as string)}` : 'none',
    },

    '.sidebar &:hover': {
      color: isBackgroundWhite
        ? 'var(--sb-accentSidebar)'
        : readableColor(cssVar('--sb-background', '#fff') as string),
      // background: isBackgroundWhite
      //   ? tint(0.94, cssVar('--sb-accentSidebar', '#fff') as string)
      //   : readableColor(
      //       cssVar('--sb-background', '#fff') as string,
      //       tint(0.3, cssVar('--sb-background', '#fff') as string),
      //       tint(0.2, cssVar('--sb-background', '#fff') as string),
      //       false
      //     ),
      // border:
      //   variant === 'outline'
      //     ? `1px solid ${tint(0.6, cssVar('--sb-accentSidebar', '#fff') as string)}`
      //     : 'none',
    },
  })
);

export const Button: FC<{ variant?: 'outline' | 'ghost' }> = ({ variant = 'ghost' }) => {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--sb-background');
  const isBackgroundWhite =
    background === 'white' ||
    background === '#fff' ||
    background === '#ffffff' ||
    background === 'rgb(255, 255, 255)' ||
    background === '';

  return (
    <ButtonStyled variant={variant} isBackgroundWhite={isBackgroundWhite}>
      <FaceHappyIcon />
      Hello World
    </ButtonStyled>
  );
};
