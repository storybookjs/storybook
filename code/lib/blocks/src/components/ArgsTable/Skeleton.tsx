import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/internal/theming';

const Row = styled.div(({ theme }) => ({
  display: 'flex',
  gap: 16,
  borderBottom: `1px solid ${theme.appBorderColor}`,

  '&:last-child': {
    borderBottom: 0,
  },
}));

const Column = styled.div<{ numColumn: number }>(({ numColumn }) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: numColumn || 1,
  gap: 5,
  padding: '12px 20px',
}));

const SkeletonText = styled.div<{ width?: number | string; height?: number }>(
  ({ theme, width, height }) => ({
    animation: `${theme.animation.glow} 1.5s ease-in-out infinite`,
    background: theme.appBorderColor,
    width: width || '100%',
    height: height || 16,
    borderRadius: 3,
  })
);

const columnWidth = [2, 4, 2, 2];

export const Skeleton: FC = () => (
  <div>
    <Row>
      <Column numColumn={columnWidth[0]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[1]}>
        <SkeletonText width="30%" />
      </Column>
      <Column numColumn={columnWidth[2]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[3]}>
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column numColumn={columnWidth[0]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[1]}>
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column numColumn={columnWidth[2]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[3]}>
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column numColumn={columnWidth[0]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[1]}>
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column numColumn={columnWidth[2]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[3]}>
        <SkeletonText width="60%" />
      </Column>
    </Row>
    <Row>
      <Column numColumn={columnWidth[0]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[1]}>
        <SkeletonText width="80%" />
        <SkeletonText width="30%" />
      </Column>
      <Column numColumn={columnWidth[2]}>
        <SkeletonText width="60%" />
      </Column>
      <Column numColumn={columnWidth[3]}>
        <SkeletonText width="60%" />
      </Column>
    </Row>
  </div>
);
