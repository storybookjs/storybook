import { useCallback, useEffect, useMemo, useState } from 'react';

import { useGlobals, useParameter } from 'storybook/manager-api';

import { PARAM_KEY } from './constants';
import { MINIMAL_VIEWPORTS } from './defaults';
import { responsiveViewport } from './responsiveViewport';
import type { GlobalStateUpdate, ViewportMap, ViewportParameters } from './types';

export const useViewport = () => {
  const config = useParameter<ViewportParameters['viewport']>(PARAM_KEY);
  const { options = MINIMAL_VIEWPORTS, disable = false } = config || {};

  const [globals, updateGlobals, storyGlobals] = useGlobals();
  const data = globals?.[PARAM_KEY] || {};

  const key = typeof data === 'string' ? data : data.value;
  const isDefault = !key || !(key in options);
  const isRotated = typeof data === 'string' ? false : !!data.isRotated;
  const isLocked = disable || PARAM_KEY in storyGlobals || !Object.keys(options).length;

  const { name, styles, type } = (options as ViewportMap)[key] || responsiveViewport;

  const [width, setWidth] = useState((isRotated ? styles.height : styles.width) || '100%');
  const [height, setHeight] = useState((isRotated ? styles.width : styles.height) || '100%');

  const update = useCallback(
    (input: GlobalStateUpdate | undefined) => updateGlobals({ [PARAM_KEY]: input }),
    [updateGlobals]
  );

  useEffect(() => {
    setWidth((isRotated ? styles.height : styles.width) || '100%');
    setHeight((isRotated ? styles.width : styles.height) || '100%');
  }, [key, isRotated, styles.height, styles.width]);

  return useMemo(
    () => ({
      key,
      name,
      type,
      width,
      height,
      isDefault,
      isRotated,
      isLocked,
      options,
      update,
      reset: () => update({ value: undefined, isRotated: false }),
      select: (value: string) => update({ value, isRotated: false }),
      rotate: () => update({ value: key, isRotated: !isRotated }),
      resize: (width: string, height: string) => {
        setWidth(isNaN(Number(width)) ? width : width + 'px');
        setHeight(isNaN(Number(height)) ? height : height + 'px');
      },
    }),
    [key, name, type, width, height, isDefault, isRotated, isLocked, options, update]
  );
};
