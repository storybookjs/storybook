import { useCallback, useEffect, useMemo, useRef } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { useGlobals, useParameter, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, PARAM_KEY } from './constants.ts';
import { MINIMAL_VIEWPORTS } from './defaults.ts';
import { VIEWPORT_MIN_HEIGHT, VIEWPORT_MIN_WIDTH, resolveViewport } from './resolveViewport.ts';
import type { GlobalState, GlobalStateUpdate, ViewportMap, ViewportParameters } from './types.ts';

export { VIEWPORT_MIN_HEIGHT, VIEWPORT_MIN_WIDTH };

const cycle = (
  viewports: ViewportMap,
  current: string | undefined,
  direction: 1 | -1 = 1
): string => {
  const keys = Object.keys(viewports);
  const currentIndex = current ? keys.indexOf(current) : -1;
  const nextIndex = currentIndex + direction;
  return nextIndex < 0
    ? keys[keys.length - 1]
    : nextIndex >= keys.length
      ? keys[0]
      : keys[nextIndex];
};

const normalizeGlobal = (
  value: string | GlobalState | GlobalStateUpdate,
  defaultIsRotated?: boolean
): GlobalState =>
  typeof value === 'string'
    ? { value, isRotated: defaultIsRotated }
    : { value: value?.value, isRotated: value?.isRotated ?? defaultIsRotated };

export const useViewport = () => {
  const api = useStorybookApi();
  const { viewMode } = api.getUrlState();

  const lastSelectedOption = useRef<string | undefined>();

  const parameter = useParameter<ViewportParameters['viewport']>(PARAM_KEY);
  const [globals, updateGlobals, storyGlobals, userGlobals] = useGlobals();

  useEffect(() => {
    if (parameter && 'defaultViewport' in parameter) {
      const value = (parameter as { defaultViewport?: unknown }).defaultViewport;
      deprecate(
        `The \`viewport.defaultViewport\` parameter was removed in Storybook 10. ` +
          `Use \`globals: { viewport: ${JSON.stringify(value)} }\` instead, ` +
          `or run \`npx storybook automigrate\` to update your code automatically.`
      );
    }
  }, [parameter]);

  const { options = MINIMAL_VIEWPORTS, disable = false } = parameter || {};
  const { name, type, width, height, value, option, isCustom, isDefault, isLocked, isRotated } =
    resolveViewport({
      globals,
      storyGlobals,
      userGlobals,
      options,
      lastSelectedOption: lastSelectedOption.current,
      disable,
      viewMode,
    });

  const update = useCallback(
    (input: GlobalStateUpdate) => updateGlobals({ [PARAM_KEY]: normalizeGlobal(input, false) }),
    [updateGlobals]
  );

  const resize = useCallback(
    (width: string, height: string) => {
      const w = width.replace(/px$/, '').replace(/%$/, 'pct');
      const h = height.replace(/px$/, '').replace(/%$/, 'pct');
      const value = isRotated ? `${h}-${w}` : `${w}-${h}`;
      update({ value, isRotated });
    },
    [update, isRotated]
  );

  useEffect(() => {
    // Skip if parameter not loaded to avoid race condition with default MINIMAL_VIEWPORTS
    if (!parameter) {
      return;
    }

    // Track valid options; if invalid and no story-level viewport is set, reset to default
    if (option) {
      if (Object.hasOwn(options, option)) {
        lastSelectedOption.current = option;
      } else {
        lastSelectedOption.current = undefined;
        if (!(PARAM_KEY in storyGlobals)) {
          update({ value: undefined, isRotated: false });
        }
      }
    }
  }, [parameter, storyGlobals, options, option, update]);

  useEffect(() => {
    api.setAddonShortcut(ADDON_ID, {
      label: 'Next viewport',
      defaultShortcut: ['alt', 'V'],
      actionName: 'next',
      action: () => update({ value: cycle(options, lastSelectedOption.current), isRotated }),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Previous viewport',
      defaultShortcut: ['alt', 'shift', 'V'],
      actionName: 'previous',
      action: () => update({ value: cycle(options, lastSelectedOption.current, -1), isRotated }),
    });
    api.setAddonShortcut(ADDON_ID, {
      label: 'Reset viewport',
      defaultShortcut: ['alt', 'control', 'V'],
      actionName: 'reset',
      action: () => update({ value: undefined, isRotated: false }),
    });
  }, [api, update, options, isRotated]);

  return useMemo(
    () => ({
      name,
      type,
      width,
      height,
      value,
      option,
      isCustom,
      isDefault,
      isLocked,
      isRotated,
      options,
      lastSelectedOption: lastSelectedOption.current,
      resize,
      reset: () => update({ value: undefined, isRotated: false }),
      rotate: () => update({ value, isRotated: !isRotated }),
      select: (value: string) => update({ value, isRotated }),
    }),
    [
      name,
      type,
      width,
      height,
      value,
      option,
      isCustom,
      isDefault,
      isRotated,
      isLocked,
      options,
      resize,
      update,
    ]
  );
};
