import { styled } from '@storybook/theming';
import type { FC } from 'react';
import React from 'react';

interface CollapseIconProps {
  isExpanded: boolean;
}

export const CollapseIconWrapper = styled.div<{ isExpanded: boolean }>(({ isExpanded }) => ({
  width: 8,
  height: 8,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  transform: isExpanded ? 'rotateZ(90deg)' : 'none',
  transition: 'transform .1s ease-out',
}));

export const CollapseIcon: FC<CollapseIconProps> = ({ isExpanded }) => (
  <CollapseIconWrapper isExpanded={isExpanded}>
    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none">
      <path
        fill="var(--sb-sidebar-arrow)"
        fillRule="evenodd"
        d="M1.896 7.146a.5.5 0 1 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 1 0-.708.708L5.043 4 1.896 7.146Z"
        clipRule="evenodd"
      />
    </svg>
  </CollapseIconWrapper>
);
