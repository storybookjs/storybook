import type { ReactNode } from 'react';
import React, { useState } from 'react';

import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import { Global, styled } from 'storybook/internal/theming';

import { AccessibilityIcon } from '@storybook/icons';

import { Filters } from './ColorFilters';

const iframeId = 'storybook-preview-iframe';

interface Option {
  name: string;
  percentage?: number;
}

export const baseList = [
  { name: 'blurred vision', percentage: 22.9 },
  { name: 'deuteranomaly', percentage: 2.7 },
  { name: 'deuteranopia', percentage: 0.56 },
  { name: 'protanomaly', percentage: 0.66 },
  { name: 'protanopia', percentage: 0.59 },
  { name: 'tritanomaly', percentage: 0.01 },
  { name: 'tritanopia', percentage: 0.016 },
  { name: 'achromatopsia', percentage: 0.0001 },
  { name: 'grayscale' },
] as Option[];

type Filter = Option | null;

const getFilter = (filterName: string) => {
  if (!filterName) {
    return 'none';
  }
  if (filterName === 'blurred vision') {
    return 'blur(2px)';
  }
  if (filterName === 'grayscale') {
    return 'grayscale(100%)';
  }
  return `url('#${filterName}')`;
};

const Hidden = styled.div(() => ({
  '&, & svg': {
    position: 'absolute',
    width: 0,
    height: 0,
  },
}));

const ColorIcon = styled.span<{ filter: string }>(
  {
    background: 'linear-gradient(to right, #F44336, #FF9800, #FFEB3B, #8BC34A, #2196F3, #9C27B0)',
    borderRadius: '1rem',
    display: 'block',
    height: '1rem',
    width: '1rem',
  },
  ({ filter }) => ({
    filter: getFilter(filter),
  }),
  ({ theme }) => ({
    boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
  })
);

export interface Link {
  id: string;
  title: ReactNode;
  right?: ReactNode;
  active: boolean;
  onClick: () => void;
}

const Column = styled.span({
  display: 'flex',
  flexDirection: 'column',
});

const Title = styled.span({
  textTransform: 'capitalize',
});

const Description = styled.span(({ theme }) => ({
  fontSize: 11,
  color: theme.textMutedColor,
}));

const getColorList = (active: Filter, set: (i: Filter) => void): Link[] => [
  ...(active !== null
    ? [
        {
          id: 'reset',
          title: 'Reset color filter',
          onClick: () => {
            set(null);
          },
          right: undefined,
          active: false,
        },
      ]
    : []),
  ...baseList.map((i) => {
    const description = i.percentage !== undefined ? `${i.percentage}% of users` : undefined;
    return {
      id: i.name,
      title: (
        <Column>
          <Title>{i.name}</Title>
          {description && <Description>{description}</Description>}
        </Column>
      ),
      onClick: () => {
        set(i);
      },
      right: <ColorIcon filter={i.name} />,
      active: active === i,
    };
  }),
];

export const VisionSimulator = () => {
  const [filter, setFilter] = useState<Filter>(null);
  return (
    <>
      {filter && (
        <Global
          styles={{
            [`#${iframeId}`]: {
              filter: getFilter(filter.name),
            },
          }}
        />
      )}
      <WithTooltip
        placement="top"
        tooltip={({ onHide }) => {
          const colorList = getColorList(filter, (i) => {
            setFilter(i);
            onHide();
          });
          return <TooltipLinkList links={colorList} />;
        }}
        closeOnOutsideClick
        onDoubleClick={() => setFilter(null)}
      >
        <IconButton key="filter" active={!!filter} title="Vision simulator">
          <AccessibilityIcon />
        </IconButton>
      </WithTooltip>
      <Hidden>
        <Filters />
      </Hidden>
    </>
  );
};
