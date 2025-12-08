import React from 'react';

import { Select } from 'storybook/internal/components';

import { ButtonIcon } from '@storybook/icons';

import { useGlobals } from 'storybook/manager-api';

import { PARAM_KEY, PSEUDO_STATES } from '../constants';

const pseudoStates = Object.keys(PSEUDO_STATES).sort() as (keyof typeof PSEUDO_STATES)[];

export const PseudoStateTool = () => {
  const [globals, updateGlobals] = useGlobals();

  const defaultOptions = Object.keys(globals[PARAM_KEY] || {}).filter((key) =>
    pseudoStates.includes(key as keyof typeof PSEUDO_STATES)
  );

  const options = pseudoStates.map((option) => {
    return {
      title: `:${PSEUDO_STATES[option]}`,
      value: option,
    };
  });

  return (
    <Select
      resetLabel="Reset pseudo states"
      onReset={() => updateGlobals({ [PARAM_KEY]: {} })}
      icon={<ButtonIcon />}
      ariaLabel="CSS pseudo states"
      tooltip="Apply CSS pseudo states"
      defaultOptions={defaultOptions}
      options={options}
      multiSelect
      onChange={(selected) => {
        updateGlobals({
          // We know curr is a string because we are using string values in options
          [PARAM_KEY]: selected.reduce((acc, curr) => ({ ...acc, [curr as string]: true }), {}),
        });
      }}
    />
  );
};
