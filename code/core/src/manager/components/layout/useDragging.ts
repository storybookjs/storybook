import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';

import type { API_Layout } from 'storybook/internal/types';

import {
  MINIMUM_CONTENT_WIDTH_PX,
  MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX,
  MINIMUM_HORIZONTAL_PANEL_WIDTH_PX,
  MINIMUM_RIGHT_PANEL_WIDTH_PX,
  MINIMUM_SIDEBAR_WIDTH_PX,
  TOOLBAR_HEIGHT_PX,
} from '../../constants';
import type { LayoutState } from './Layout';

// the distance from the edge of the screen at which the panel/sidebar will snap to the edge
const SNAP_THRESHOLD_PX = 30;
const STIFFNESS = 0.9;
const KEYBOARD_STEP_PX = 10;
const KEYBOARD_SHIFT_MULTIPLIER = 5;
const RESIZE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/** Clamps a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpolates a value between min and max based on the relativeValue. */
function interpolate(relativeValue: number, min: number, max: number): number {
  return min + (max - min) * relativeValue;
}

/**
 * Computes the maximum width for the sidebar, accounting for the content minimum and the panel's
 * estimated horizontal footprint. When the panel is at the bottom its minimum enforced width is
 * reserved so the browser never squashes it below `MINIMUM_HORIZONTAL_PANEL_WIDTH_PX`.
 */
function computeSidebarMaxWidth(
  panelPosition: API_Layout['panelPosition'],
  rightPanelWidth: number,
  showPanel: boolean
): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const panelWidth = !showPanel
    ? 0
    : panelPosition === 'right'
      ? rightPanelWidth
      : MINIMUM_HORIZONTAL_PANEL_WIDTH_PX;
  return Math.max(window.innerWidth - MINIMUM_CONTENT_WIDTH_PX - panelWidth, 0);
}

/**
 * Computes the maximum size for the panel:
 *
 * - Bottom panel: `innerHeight` minus the toolbar so it cannot push the toolbar off-screen.
 * - Right panel: `innerWidth` minus the content minimum and the sidebar.
 */
function computePanelMaxSize(panelPosition: API_Layout['panelPosition'], navSize: number): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  if (panelPosition === 'bottom') {
    return Math.max(window.innerHeight - TOOLBAR_HEIGHT_PX, 0);
  }
  return Math.max(window.innerWidth - MINIMUM_CONTENT_WIDTH_PX - navSize, 0);
}

/**
 * Given the current layout state, a size key, a max size, and the key pressed, returns the next
 * layout state with the resized panel/sidebar. All sidebar/panel-specific logic lives in the
 * callers; this function is fully parameterised.
 *
 * @param sizeKey - The layout state key to resize.
 * @param maxSize - The effective maximum size for the region.
 * @param increaseKey - The key that grows the region.
 * @param decreaseKey - The key that shrinks the region.
 */
function applyResizeKeyboard(
  state: LayoutState,
  sizeKey: 'navSize' | 'bottomPanelHeight' | 'rightPanelWidth',
  key: string,
  step: number,
  minSize: number,
  maxSize: number,
  increaseKey: string,
  decreaseKey: string
): LayoutState {
  const currentSize = state[sizeKey];

  switch (key) {
    case increaseKey:
      return { ...state, [sizeKey]: clamp(currentSize + step, minSize, maxSize) };
    case decreaseKey:
      const effectivelyComputed = clamp(currentSize - step, 0, maxSize);
      return { ...state, [sizeKey]: effectivelyComputed < minSize ? 0 : effectivelyComputed };
    case 'Home':
      return { ...state, [sizeKey]: 0 };
    case 'End':
      return { ...state, [sizeKey]: maxSize };
    default:
      return state;
  }
}

export function useDragging({
  setState,
  showPanel,
  isDesktop,
  navSize,
  rightPanelWidth,
  panelPosition,
}: {
  setState: Dispatch<SetStateAction<LayoutState>>;
  showPanel: boolean;
  isDesktop: boolean;
  navSize: number;
  rightPanelWidth: number;
  panelPosition: API_Layout['panelPosition'];
}) {
  const panelResizerRef = useRef<HTMLDivElement>(null);
  const sidebarResizerRef = useRef<HTMLDivElement>(null);

  // Compute current max sizes so callers can use them for aria attributes without duplicating logic.
  // Evaluated at render time (from the same values the containers receive), so they stay in sync.
  const sidebarMaxWidth = computeSidebarMaxWidth(panelPosition, rightPanelWidth, showPanel);
  const panelMaxSize = computePanelMaxSize(panelPosition, navSize);

  useEffect(() => {
    const panelResizer = panelResizerRef.current;
    const sidebarResizer = sidebarResizerRef.current;
    const previewIframe = document.querySelector('#storybook-preview-iframe') as HTMLIFrameElement;
    let draggedElement: typeof panelResizer | typeof sidebarResizer | null = null;

    const onDragStart = (e: MouseEvent) => {
      e.preventDefault();

      setState((state) => ({
        ...state,
        isDragging: true,
      }));

      if (e.currentTarget === panelResizer) {
        draggedElement = panelResizer;
      } else if (e.currentTarget === sidebarResizer) {
        draggedElement = sidebarResizer;
      }
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', onDragEnd);

      if (previewIframe) {
        // prevent iframe from capturing mouse events
        previewIframe.style.pointerEvents = 'none';
      }
    };

    const onDragEnd = () => {
      setState((state) => {
        if (draggedElement === sidebarResizer) {
          if (state.navSize < MINIMUM_SIDEBAR_WIDTH_PX && state.navSize > 0) {
            // snap the sidebar back to its minimum width if it's smaller than the threshold
            return {
              ...state,
              isDragging: false,
              navSize: MINIMUM_SIDEBAR_WIDTH_PX,
            };
          }
        }
        if (draggedElement === panelResizer) {
          if (
            state.panelPosition === 'right' &&
            state.rightPanelWidth < MINIMUM_RIGHT_PANEL_WIDTH_PX &&
            state.rightPanelWidth > 0
          ) {
            // snap the right panel back to its minimum width if it's smaller than the threshold
            return {
              ...state,
              isDragging: false,
              rightPanelWidth: MINIMUM_RIGHT_PANEL_WIDTH_PX,
            };
          } else if (
            state.panelPosition === 'bottom' &&
            state.bottomPanelHeight < MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX &&
            state.bottomPanelHeight > 0
          ) {
            // snap the bottom panel back to its minimum height if it's smaller than the threshold
            return {
              ...state,
              isDragging: false,
              bottomPanelHeight: MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX,
            };
          }
        }
        return {
          ...state,
          isDragging: false,
        };
      });
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', onDragEnd);
      // make iframe capture pointer events again
      previewIframe?.removeAttribute('style');
      draggedElement = null;
    };

    const onDrag = (e: MouseEvent) => {
      if (e.buttons === 0) {
        onDragEnd();
        return;
      }

      setState((state) => {
        if (draggedElement === sidebarResizer) {
          const sidebarDragX = e.clientX;

          if (sidebarDragX === state.navSize) {
            return state;
          }
          if (sidebarDragX <= SNAP_THRESHOLD_PX) {
            return {
              ...state,
              navSize: 0,
            };
          }
          if (sidebarDragX <= MINIMUM_SIDEBAR_WIDTH_PX) {
            // set sidebar width to a value in between the actual drag position and the min width, determined by the stiffness
            return {
              ...state,
              navSize: interpolate(STIFFNESS, sidebarDragX, MINIMUM_SIDEBAR_WIDTH_PX),
            };
          }
          return {
            ...state,
            navSize: clamp(
              sidebarDragX,
              0,
              computeSidebarMaxWidth(state.panelPosition, state.rightPanelWidth, showPanel)
            ),
          };
        }
        if (draggedElement === panelResizer) {
          const sizeAxisState =
            state.panelPosition === 'bottom' ? 'bottomPanelHeight' : 'rightPanelWidth';
          const panelDragSize =
            state.panelPosition === 'bottom'
              ? // @ts-expect-error (non strict)
                e.view.innerHeight - e.clientY
              : // @ts-expect-error (non strict)
                e.view.innerWidth - e.clientX;
          const minimumSize =
            state.panelPosition === 'bottom'
              ? MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX
              : MINIMUM_RIGHT_PANEL_WIDTH_PX;

          if (panelDragSize === state[sizeAxisState]) {
            return state;
          }
          if (panelDragSize <= SNAP_THRESHOLD_PX) {
            return {
              ...state,
              [sizeAxisState]: 0,
            };
          }
          // set panel width/height to a value in between the actual drag position and the min size, determined by the stiffness
          if (panelDragSize <= minimumSize) {
            return {
              ...state,
              [sizeAxisState]: interpolate(STIFFNESS, panelDragSize, minimumSize),
            };
          }

          return {
            ...state,
            [sizeAxisState]: clamp(
              panelDragSize,
              0,
              computePanelMaxSize(state.panelPosition, state.navSize)
            ),
          };
        }
        return state;
      });
    };

    const onSidebarKeyDown = (e: KeyboardEvent) => {
      if (!RESIZE_KEYS.includes(e.key)) {
        return;
      }
      e.preventDefault();
      const step = e.shiftKey ? KEYBOARD_STEP_PX * KEYBOARD_SHIFT_MULTIPLIER : KEYBOARD_STEP_PX;
      setState((state) =>
        applyResizeKeyboard(
          state,
          'navSize',
          e.key,
          step,
          MINIMUM_SIDEBAR_WIDTH_PX,
          computeSidebarMaxWidth(state.panelPosition, state.rightPanelWidth, showPanel),
          'ArrowRight',
          'ArrowLeft'
        )
      );
    };

    const onPanelKeyDown = (e: KeyboardEvent) => {
      if (!RESIZE_KEYS.includes(e.key)) {
        return;
      }
      e.preventDefault();
      const step = e.shiftKey ? KEYBOARD_STEP_PX * KEYBOARD_SHIFT_MULTIPLIER : KEYBOARD_STEP_PX;
      setState((state) =>
        applyResizeKeyboard(
          state,
          state.panelPosition === 'bottom' ? 'bottomPanelHeight' : 'rightPanelWidth',
          e.key,
          step,
          state.panelPosition === 'bottom'
            ? MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX
            : MINIMUM_RIGHT_PANEL_WIDTH_PX,
          computePanelMaxSize(state.panelPosition, state.navSize),
          state.panelPosition === 'bottom' ? 'ArrowUp' : 'ArrowLeft',
          state.panelPosition === 'bottom' ? 'ArrowDown' : 'ArrowRight'
        )
      );
    };

    panelResizer?.addEventListener('mousedown', onDragStart);
    sidebarResizer?.addEventListener('mousedown', onDragStart);
    panelResizer?.addEventListener('keydown', onPanelKeyDown);
    sidebarResizer?.addEventListener('keydown', onSidebarKeyDown);

    return () => {
      panelResizer?.removeEventListener('mousedown', onDragStart);
      sidebarResizer?.removeEventListener('mousedown', onDragStart);
      panelResizer?.removeEventListener('keydown', onPanelKeyDown);
      sidebarResizer?.removeEventListener('keydown', onSidebarKeyDown);
      // make iframe capture pointer events again
      previewIframe?.removeAttribute('style');
    };
  }, [
    // we need to rerun this effect when the panel is shown/hidden or when changing between mobile/desktop to re-attach the event listeners
    showPanel,
    isDesktop,
    setState,
  ]);

  return { panelResizerRef, sidebarResizerRef, sidebarMaxWidth, panelMaxSize };
}
