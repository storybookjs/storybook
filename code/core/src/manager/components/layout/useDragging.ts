import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';

import type { LayoutState } from './Layout';

// the distance from the edge of the screen at which the panel/sidebar will snap to the edge
const SNAP_THRESHOLD_PX = 30;
const SIDEBAR_MIN_WIDTH_PX = 240;
const RIGHT_PANEL_MIN_WIDTH_PX = 270;
const MIN_WIDTH_STIFFNESS = 0.9;

/** Clamps a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpolates a value between min and max based on the relativeValue. */
function interpolate(relativeValue: number, min: number, max: number): number {
  return min + (max - min) * relativeValue;
}

export function useDragging({
  setState,
  isPanelShown,
  isDesktop,
}: {
  setState: Dispatch<SetStateAction<LayoutState>>;
  isPanelShown: boolean;
  isDesktop: boolean;
}) {
  const panelResizerRef = useRef<HTMLDivElement>(null);
  const sidebarResizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panelResizer = panelResizerRef.current;
    const sidebarResizer = sidebarResizerRef.current;
    const previewIframe = document.querySelector('#storybook-preview-wrapper') as HTMLIFrameElement;
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

    const onDragEnd = (e: MouseEvent) => {
      setState((state) => {
        if (draggedElement === sidebarResizer) {
          if (state.navSize < SIDEBAR_MIN_WIDTH_PX && state.navSize > 0) {
            // snap the sidebar back to its minimum width if it's smaller than the threshold
            return {
              ...state,
              isDragging: false,
              navSize: SIDEBAR_MIN_WIDTH_PX,
            };
          }
        }
        if (draggedElement === panelResizer) {
          if (
            state.panelPosition === 'right' &&
            state.rightPanelWidth < RIGHT_PANEL_MIN_WIDTH_PX &&
            state.rightPanelWidth > 0
          ) {
            // snap the right panel back to its minimum width if it's smaller than the threshold
            return {
              ...state,
              isDragging: false,
              rightPanelWidth: RIGHT_PANEL_MIN_WIDTH_PX,
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
        onDragEnd(e);
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
          if (sidebarDragX <= SIDEBAR_MIN_WIDTH_PX) {
            // set sidebar width to a value in between the actual drag position and the min width, determined by the stiffness
            return {
              ...state,
              navSize: interpolate(MIN_WIDTH_STIFFNESS, sidebarDragX, SIDEBAR_MIN_WIDTH_PX),
            };
          }
          return {
            ...state,
            // @ts-expect-error (non strict)
            navSize: clamp(sidebarDragX, 0, e.view.innerWidth),
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

          if (panelDragSize === state[sizeAxisState]) {
            return state;
          }
          if (panelDragSize <= SNAP_THRESHOLD_PX) {
            return {
              ...state,
              [sizeAxisState]: 0,
            };
          }
          if (state.panelPosition === 'right' && panelDragSize <= RIGHT_PANEL_MIN_WIDTH_PX) {
            // set right panel width to a value in between the actual drag position and the min width, determined by the stiffness
            return {
              ...state,
              [sizeAxisState]: interpolate(
                MIN_WIDTH_STIFFNESS,
                panelDragSize,
                RIGHT_PANEL_MIN_WIDTH_PX
              ),
            };
          }

          const sizeAxisMax =
            // @ts-expect-error (non strict)
            state.panelPosition === 'bottom' ? e.view.innerHeight : e.view.innerWidth;
          return {
            ...state,
            [sizeAxisState]: clamp(panelDragSize, 0, sizeAxisMax),
          };
        }
        return state;
      });
    };

    panelResizer?.addEventListener('mousedown', onDragStart);
    sidebarResizer?.addEventListener('mousedown', onDragStart);

    return () => {
      panelResizer?.removeEventListener('mousedown', onDragStart);
      sidebarResizer?.removeEventListener('mousedown', onDragStart);
      // make iframe capture pointer events again
      previewIframe?.removeAttribute('style');
    };
  }, [
    // we need to rerun this effect when the panel is shown/hidden or when changing between mobile/desktop to re-attach the event listeners
    isPanelShown,
    isDesktop,
    setState,
  ]);

  return { panelResizerRef, sidebarResizerRef };
}
