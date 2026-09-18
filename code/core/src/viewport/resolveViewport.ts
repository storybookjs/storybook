import type { Globals } from 'storybook/internal/csf';

import { PARAM_KEY, RESPONSIVE_VIEWPORT_VALUE } from './constants.ts';
import type { GlobalState, GlobalStateUpdate, ViewportMap, ViewportType } from './types.ts';

export const VIEWPORT_MIN_WIDTH = 40;
export const VIEWPORT_MIN_HEIGHT = 40;

// Custom viewport format, e.g. '100pct-200px' (width-height)
const URL_VALUE_PATTERN = /^([0-9]{1,4})([a-z]{0,4})-([0-9]{1,4})([a-z]{0,4})$/;

export type ResolvedViewport = {
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
};

const normalizeGlobal = (
  value: string | GlobalState | GlobalStateUpdate,
  defaultIsRotated?: boolean
): GlobalState =>
  typeof value === 'string'
    ? { value, isRotated: defaultIsRotated }
    : { value: value?.value, isRotated: value?.isRotated ?? defaultIsRotated };

export type ResolveViewportInput = {
  globals: Globals;
  storyGlobals: Globals;
  userGlobals: Globals;
  options: ViewportMap;
  lastSelectedOption?: string;
  disable?: boolean;
  viewMode?: string;
};

export const resolveViewport = ({
  globals,
  storyGlobals,
  userGlobals,
  options,
  lastSelectedOption,
  disable = false,
  viewMode,
}: ResolveViewportInput): ResolvedViewport => {
  if (viewMode !== 'story') {
    return {
      name: 'Responsive',
      type: 'desktop',
      width: '100%',
      height: '100%',
      value: RESPONSIVE_VIEWPORT_VALUE,
      option: undefined,
      isCustom: false,
      isDefault: true,
      isLocked: true,
      isRotated: false,
    };
  }

  const global = normalizeGlobal(globals?.[PARAM_KEY]);
  const userGlobal = normalizeGlobal(userGlobals?.[PARAM_KEY]);
  const storyGlobal = normalizeGlobal(storyGlobals?.[PARAM_KEY]);
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
    const x = ux && ux !== 'px' ? vx : Math.max(Number(vx), VIEWPORT_MIN_WIDTH);
    const y = uy && uy !== 'px' ? vy : Math.max(Number(vy), VIEWPORT_MIN_HEIGHT);

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
    value: RESPONSIVE_VIEWPORT_VALUE,
    option: undefined,
    isCustom: false,
    isDefault: true,
    isLocked,
    isRotated: false,
  };
};

/** Resolve a viewport CSS dimension to pixels when the unit allows it. */
export const toViewportPixels = (dimension: string, reference: number): number | undefined => {
  const pxMatch = dimension.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch) {
    return Math.round(Number(pxMatch[1]));
  }

  const percentMatch = dimension.match(/^(\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    return Math.round((reference * Number(percentMatch[1])) / 100);
  }

  return undefined;
};

export type ResolvedViewportDimensions = {
  name: string;
  value: string;
  width?: number;
  height?: number;
};

export const toResolvedViewportDimensions = (
  viewport: ResolvedViewport,
  reference: { width: number; height: number }
): ResolvedViewportDimensions => ({
  name: viewport.name,
  value: viewport.value,
  width: toViewportPixels(viewport.width, reference.width),
  height: toViewportPixels(viewport.height, reference.height),
});
