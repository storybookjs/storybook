import React from 'react';

import { Select } from 'storybook/internal/components';

import { AccessibilityIcon } from '@storybook/icons';

import { useGlobals } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { VISION_GLOBAL_KEY } from '../constants';
import { filterDefs, filters } from '../visionSimulatorFilters';

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
    borderRadius: 14,
    display: 'block',
    flexShrink: 0,
    height: 14,
    width: 14,
  },
  ({ $filter }) => ({
    filter: filters[$filter as keyof typeof filters].filter || 'none',
  }),
  ({ theme }) => ({
    boxShadow: `${theme.appBorderColor} 0 0 0 1px inset`,
  })
);

export const VisionSimulator = () => {
  const [globals, updateGlobals] = useGlobals();
  const value = globals[VISION_GLOBAL_KEY];

  const options = Object.entries(filters).map(([key, { label, percentage }]) => ({
    title: label,
    description: percentage ? `${percentage}% of users` : undefined,
    icon: <ColorIcon $filter={key} />,
    value: key,
  }));

  return (
    <>
      <Select
        resetLabel="Reset color filter"
        onReset={() => updateGlobals({ [VISION_GLOBAL_KEY]: undefined })}
        icon={<AccessibilityIcon />}
        ariaLabel="Vision simulator"
        defaultOptions={value}
        options={options}
        onSelect={(selected) => updateGlobals({ [VISION_GLOBAL_KEY]: selected })}
      />
      <Hidden dangerouslySetInnerHTML={{ __html: filterDefs }} />
    </>
  );
};
