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

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && !!value;

const parseTarget = (value: unknown): HighlightMenuTarget | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { key, id, label, details } = value;
  const parsedDetails = parseDetails(details);
  if (!isNonEmptyString(key) || !isNonEmptyString(id) || typeof label !== 'string') {
    return undefined;
  }
  if (!parsedDetails) {
    return undefined;
  }

  return { key, id, label, details: parsedDetails };
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

  if (value.open === false) {
    return { open: false };
  }

  const { open, targets, selected, coords } = value;
  if (open !== true || !Array.isArray(targets) || !targets.length) {
    return undefined;
  }

  const parsedTargets: HighlightMenuTarget[] = [];
  for (const target of targets) {
    const parsedTarget = parseTarget(target);
    if (!parsedTarget || parsedTargets.some(({ key }) => key === parsedTarget.key)) {
      return undefined;
    }
    parsedTargets.push(parsedTarget);
  }

  if (selected !== null && !parsedTargets.some(({ key }) => key === selected)) {
    return undefined;
  }

  if (!isObject(coords) || !isFiniteNumber(coords.x) || !isFiniteNumber(coords.y)) {
    return undefined;
  }

  return {
    open: true,
    targets: parsedTargets,
    selected: selected as string | null,
    coords: { x: coords.x, y: coords.y },
  };
};

/**
 * Validate the runtime payload of a `HIGHLIGHT_MENU_INTERACTION` event. Unknown actions and
 * malformed keys are ignored so they cannot corrupt selection or focus state in the preview.
 */
export const parseHighlightMenuInteraction = (
  value: unknown
): HighlightMenuInteraction | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const { action, key } = value;
  if (action === 'deselect' || action === 'blur' || action === 'close') {
    return { action };
  }

  if ((action === 'select' || action === 'focus') && isNonEmptyString(key)) {
    return { action, key };
  }

  return undefined;
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
