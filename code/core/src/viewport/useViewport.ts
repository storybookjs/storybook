import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { Globals } from 'storybook/internal/csf';

import { useGlobals, useParameter, useStorybookApi } from 'storybook/manager-api';

import { ADDON_ID, PARAM_KEY } from './constants';
import { MINIMAL_VIEWPORTS } from './defaults';
import type {
  GlobalState,
  GlobalStateUpdate,
  ViewportMap,
  ViewportParameters,
  ViewportType,
} from './types';

// Custom viewport format, e.g. '100pct-200px' (width-height)
const URL_VALUE_PATTERN = /^([0-9]{1,4})([a-z]{0,4})-([0-9]{1,4})([a-z]{0,4})$/;

export const VIEWPORT_MIN_WIDTH = 40;
export const VIEWPORT_MIN_HEIGHT = 40;

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

const parseGlobals = (
  globals: Globals,
  storyGlobals: Globals,
  userGlobals: Globals,
  options: ViewportMap,
  lastSelectedOption: string | undefined,
  disable: boolean,
  viewMode: string | undefined
): {
  name: string;
  type: ViewportType;
  width: string;
  height: string;
  value: string;
  option: string | undefined;
  isCustom: boolean;
  isDefault: boolean;
  isLocked: boolean;
  isRotated: boolean;
} => {
  if (viewMode !== 'story') {
    return {
      name: 'Responsive',
      type: 'desktop',
      width: '100%',
      height: '100%',
      value: '100pct-100pct',
      option: undefined,
      isCustom: false,
      isDefault: true,
      isLocked: true,
      isRotated: false,
    };
  }

  const global = normalizeGlobal(globals?.[PARAM_KEY], false);
  const userGlobal = normalizeGlobal(userGlobals?.[PARAM_KEY], false);
  const storyGlobal = normalizeGlobal(storyGlobals?.[PARAM_KEY], false);
  const storyHasViewport = PARAM_KEY in storyGlobals;

  // Story-level viewport globals override user globals for the current story.
  const primaryGlobal = storyHasViewport ? storyGlobal : userGlobal;
  const secondaryGlobal = storyHasViewport ? userGlobal : storyGlobal;
  const value = primaryGlobal?.value ?? secondaryGlobal?.value ?? global?.value;
  const isRotated =
    primaryGlobal?.isRotated ?? secondaryGlobal?.isRotated ?? global?.isRotated ?? false;

  const keys = Object.keys(options);
  const isLocked = disable || PARAM_KEY in storyGlobals || !keys.length;
  const [match, vx, ux, vy, uy] = value?.match(URL_VALUE_PATTERN) || [];

  if (match) {
    // Clamp pixel values to at least MIN_WIDTH / MIN_HEIGHT
    const x = ux && ux !== 'px' ? vx : Math.max(Number(vx), VIEWPORT_MIN_WIDTH);
    const y = uy && uy !== 'px' ? vy : Math.max(Number(vy), VIEWPORT_MIN_HEIGHT);

    // Ensure we have a valid CSS value, including unit
    const width = `${x}${ux === 'pct' ? '%' : ux || 'px'}`;
    const height = `${y}${uy === 'pct' ? '%' : uy || 'px'}`;

    const selection = lastSelectedOption ? options[lastSelectedOption] : undefined;
    return {
      name: selection?.name ?? 'Custom',
      type: selection?.type ?? 'other',
      width: isRotated ? height : width,
      height: isRotated ? width : height,
      value: match,
      option: undefined,
      isCustom: true,
      isDefault: false,
      isLocked,
      isRotated,
    };
  }

  if (value && keys.length) {
    const { name, styles, type = 'other' } = options[value] ?? options[keys[0]];
    return {
      name,
      type,
      width: isRotated ? styles.height : styles.width,
      height: isRotated ? styles.width : styles.height,
      value,
      option: value,
      isCustom: false,
      isDefault: false,
      isLocked,
      isRotated,
    };
  }

  return {
    name: 'Responsive',
    type: 'desktop',
    width: '100%',
    height: '100%',
    value: '100pct-100pct',
    option: undefined,
    isCustom: false,
    isDefault: true,
    isLocked,
    isRotated: false,
  };
};

export const useViewport = () => {
  const api = useStorybookApi();
  const { viewMode } = api.getUrlState();

  const lastSelectedOption = useRef<string | undefined>();

  const parameter = useParameter<ViewportParameters['viewport']>(PARAM_KEY);
  const [globals, updateGlobals, storyGlobals, userGlobals] = useGlobals();

  const { options = MINIMAL_VIEWPORTS, disable = false } = parameter || {};
  const { name, type, width, height, value, option, isCustom, isDefault, isLocked, isRotated } =
    parseGlobals(
      globals,
      storyGlobals,
      userGlobals,
      options,
      lastSelectedOption.current,
      disable,
      viewMode
    );

  const update = useCallback(
    (input: GlobalStateUpdate) => updateGlobals({ [PARAM_KEY]: normalizeGlobal(input, false) }),
    [updateGlobals]
  );

  const resize = useCallback(
    (width: string, height: string) => {
      const w = width.replace(/px$/, '').replace(/%$/, 'pct');
      const h = height.replace(/px$/, '').replace(/%$/, 'pct');
      const value = isRotated ? `${h}-${w}` : `${w}-${h}`;
      const [match, vx, ux, vy, uy] = value.match(URL_VALUE_PATTERN) || [];

      // Don't update to pixel values less than 40
      if (match && (ux || Number(vx) >= 40) && (uy || Number(vy) >= 40)) {
        update({ value: match, isRotated });
      }
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
