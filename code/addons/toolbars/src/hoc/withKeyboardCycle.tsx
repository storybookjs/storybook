import React, { useRef, useEffect, useCallback } from 'react';
import { useGlobals, useStorybookApi } from 'storybook/internal/manager-api';
import { createCycleValueArray } from '../utils/create-cycle-value-array';
import { registerShortcuts } from '../utils/register-shortcuts';
import type { ToolbarMenuProps } from '../types';

export type WithKeyboardCycleProps = {
  cycleValues?: string[];
};

export const withKeyboardCycle = (Component: React.ComponentType<ToolbarMenuProps>) => {
  const WithKeyboardCycle = (props: ToolbarMenuProps) => {
    const {
      id,
      toolbar: { items, shortcuts },
    } = props;

    const api = useStorybookApi();
    const [globals, updateGlobals] = useGlobals();
    const cycleValues = useRef<any[]>([]);
    const currentValue = globals[id];

    const reset = useCallback(() => {
      updateGlobals({ [id]: '' });
    }, [updateGlobals]);

    const setNext = useCallback(() => {
      const values = cycleValues.current;
      const currentIndex = values.indexOf(currentValue);
      const currentIsLast = currentIndex === values.length - 1;

      const newCurrentIndex = currentIsLast ? 0 : currentIndex + 1;
      const newCurrent = cycleValues.current[newCurrentIndex];

      updateGlobals({ [id]: newCurrent });
    }, [cycleValues, currentValue, updateGlobals]);

    const setPrevious = useCallback(() => {
      const values = cycleValues.current;
      const indexOf = values.indexOf(currentValue);
      const currentIndex = indexOf > -1 ? indexOf : 0;
      const currentIsFirst = currentIndex === 0;

      const newCurrentIndex = currentIsFirst ? values.length - 1 : currentIndex - 1;
      const newCurrent = cycleValues.current[newCurrentIndex];

      updateGlobals({ [id]: newCurrent });
    }, [cycleValues, currentValue, updateGlobals]);

    useEffect(() => {
      if (shortcuts) {
        registerShortcuts(api, id, {
          next: { ...shortcuts.next, action: setNext },
          previous: { ...shortcuts.previous, action: setPrevious },
          reset: { ...shortcuts.reset, action: reset },
        });
      }
    }, [api, id, shortcuts, setNext, setPrevious, reset]);

    useEffect(() => {
      cycleValues.current = createCycleValueArray(items);
    }, []);

    return <Component cycleValues={cycleValues.current} {...props} />;
  };

  return WithKeyboardCycle;
};
