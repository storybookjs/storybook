import type {
  ClickEventDetails,
  HighlightMenuInteraction,
  HighlightMenuState,
  HighlightMenuTarget,
  HighlightOptions,
} from './types.ts';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const parseDetails = (value: unknown): ClickEventDetails | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { top, left, width, height, selectors, element } = value;
  if (
    !isFiniteNumber(top) ||
    !isFiniteNumber(left) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    !isStringArray(selectors)
  ) {
    return undefined;
  }
  if (!isObject(element)) {
    return undefined;
  }

  const { localName, tagName } = element;
  if (typeof localName !== 'string' || typeof tagName !== 'string') {
    return undefined;
  }

  return {
    top,
    left,
    width,
    height,
    selectors,
    element: { localName, tagName },
  };
};

const parseTarget = (value: unknown): HighlightMenuTarget | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { id, label, details } = value;
  const parsedDetails = parseDetails(details);
  if (typeof id !== 'string' || !id || typeof label !== 'string' || !parsedDetails) {
    return undefined;
  }

  return { id, label, details: parsedDetails };
};

/**
 * Validate the runtime payload of a `HIGHLIGHT_MENU` event. The preview is a separate frame, so the
 * manager cannot trust its payload to match the TypeScript types at runtime. Invalid payloads are
 * ignored rather than rendered.
 */
export const parseHighlightMenuState = (value: unknown): HighlightMenuState | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { targets, selected, coords } = value;
  if (!Array.isArray(targets)) {
    return undefined;
  }

  if (targets.length === 0) {
    if (selected === null && coords === null) {
      return { targets: [], selected: null, coords: null };
    }
    return undefined;
  }

  const parsedTargets = targets.map(parseTarget);
  if (parsedTargets.some((target) => !target)) {
    return undefined;
  }

  if (
    selected !== null &&
    (typeof selected !== 'number' ||
      !Number.isInteger(selected) ||
      selected < 0 ||
      selected >= parsedTargets.length)
  ) {
    return undefined;
  }

  if (!isObject(coords) || !isFiniteNumber(coords.x) || !isFiniteNumber(coords.y)) {
    return undefined;
  }

  return {
    targets: parsedTargets as HighlightMenuTarget[],
    selected: selected as number | null,
    coords: { x: coords.x as number, y: coords.y as number },
  };
};

/**
 * Validate the runtime payload of a `HIGHLIGHT_MENU_INTERACTION` event against the current target
 * list. Out-of-bounds indices and unknown actions are ignored so they cannot corrupt selection or
 * focus state in the preview.
 */
export const parseHighlightMenuInteraction = (
  value: unknown,
  targetCount: number
): HighlightMenuInteraction | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { action, index } = value;
  if (action === 'deselect' || action === 'blur' || action === 'close') {
    return { action };
  }

  if (action !== 'select' && action !== 'focus') {
    return undefined;
  }

  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= targetCount) {
    return undefined;
  }

  return { action, index: index as number };
};

/**
 * Validate a `HIGHLIGHT` payload before it is stored in the manager-side registry. The preview only
 * sends an id and selectors; menu definitions are registered separately and are never taken from
 * the menu state event.
 */
export const isHighlightOptions = (value: unknown): value is HighlightOptions => {
  if (!isObject(value) || typeof value.id !== 'string' || !value.id) {
    return false;
  }

  return value.selectors === undefined || isStringArray(value.selectors);
};
