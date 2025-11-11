import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

const TableWrapper = styled.div(({ theme }) => ({
  width: '100%',
  borderSpacing: 0,
  color: theme.color.defaultText,
}));

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  borderBottom: `1px solid ${theme.appBorderColor}`,

  '&:last-child': {
    borderBottom: 0,
  },
}));

const Column = styled.div<{ position: 'first' | 'second' | 'third' | 'last' }>(({ position }) => {
  const baseStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 5,
    padding: '10px 15px',
    alignItems: 'flex-start',
  };

  // Apply the same column width ratios as the actual ArgsTable component
  switch (position) {
    case 'first':
      return {
        ...baseStyles,
        width: '25%',
        paddingLeft: 20,
      };
    case 'second':
      return {
        ...baseStyles,
        width: '35%',
      };
    case 'third':
      return {
        ...baseStyles,
        width: '15%',
      };
    case 'last':
      return {
        ...baseStyles,
        width: '25%',
        paddingRight: 20,
      };
  }
});

const SkeletonText = styled.div<{ width?: number | string; height?: number }>(
  ({ theme, width, height }) => ({
    animation: `${theme.animation.glow} 1.5s ease-in-out infinite`,
    background: theme.appBorderColor,
    width: width || '100%',
    height: height || 16,
    borderRadius: 3,
  })
);

export const Skeleton: FC = () => (
  <TableWrapper>
    <Row>
      <Column position="first">
        <SkeletonText width="60%" />
      </Column>
      <Column position="second">
        <SkeletonText width="30%" />
      </Column>
      <Column position="third">
        <SkeletonText width="60%" />
      </Column>
      <Column position="last">
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column position="first">
        <SkeletonText width="60%" />
      </Column>
      <Column position="second">
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column position="third">
        <SkeletonText width="60%" />
      </Column>
      <Column position="last">
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column position="first">
        <SkeletonText width="60%" />
      </Column>
      <Column position="second">
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column position="third">
        <SkeletonText width="60%" />
      </Column>
      <Column position="last">
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column position="first">
        <SkeletonText width="60%" />
      </Column>
      <Column position="second">
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column position="third">
        <SkeletonText width="60%" />
      </Column>
      <Column position="last">
        <SkeletonText width="60%" />
      </Column>
    </Row>
  </TableWrapper>
);
