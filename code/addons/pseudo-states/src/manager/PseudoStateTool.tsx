import React, { type ComponentProps } from 'react';

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

  const options: ComponentProps<typeof Select>['options'] = pseudoStates.map((option) => {
    return {
      label: PSEUDO_STATES[option],
      value: option,
    };
  });

  return (
    <Select
      key="pseudo-states-select-dbg"
      // TODO: reintegrate "reset all", by having it as a Select prop.
      // hasReset={true}
      // resetLabel="Reset pseudo states"
      // NOTE: could have onReset but it's redundant in this use case.
      // onReset={() => updateGlobals({ [PARAM_KEY]: {} })}
      ariaLabel="Select CSS pseudo states"
      variant="ghost"
      defaultOptions={defaultOptions}
      options={options}
      multiSelect
      onChange={(selected) => {
        updateGlobals({
          [PARAM_KEY]: selected.reduce((acc, curr) => ({ ...acc, [curr.value]: true }), {}),
        });
      }}
    >
      <ButtonIcon />
    </Select>
  );
};
