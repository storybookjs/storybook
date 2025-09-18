import React, { useState } from 'react';

import { Select } from 'storybook/internal/components';

import { AccessibilityIcon } from '@storybook/icons';

import { Global, styled } from 'storybook/theming';

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

const Hidden = styled.div({
  '&, & svg': {
    position: 'absolute',
    width: 0,
    height: 0,
  },
});

const ColorIcon = styled.span<{ $filter: string }>(
  {
    background: 'linear-gradient(to right, #F44336, #FF9800, #FFEB3B, #8BC34A, #2196F3, #9C27B0)',
    borderRadius: '1rem',
    display: 'block',
    height: '1rem',
    width: '1rem',
  },
  ({ $filter }) => ({
    filter: getFilter($filter),
  }),
  ({ theme }) => ({
    boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
  })
);

export const VisionSimulator = () => {
  const [filter, setFilter] = useState<Filter>(null);

  const options = baseList.map(({ name, percentage }) => {
    const description = percentage !== undefined ? `${percentage}% of users` : undefined;
    return {
      title: name,
      description,
      icon: <ColorIcon $filter={name} />,
      value: name,
    };
  });

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
      <Select
        resetLabel="Reset color filter"
        onReset={() => setFilter(null)}
        icon={<AccessibilityIcon />}
        ariaLabel="Vision simulator"
        defaultOptions={filter?.name}
        options={options}
        onSelect={(selected) => setFilter(() => ({ name: selected }))}
      />
      <Hidden>
        <Filters />
      </Hidden>
    </>
  );
};
