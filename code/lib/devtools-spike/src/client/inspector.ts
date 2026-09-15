/**
 * Hover-inspect machinery: arming, overlay highlight, DOM→fiber walk, and the
 * shallow props preview rendered in the panel's inspect card. All DOM access
 * lives here; source resolution stays in source-location.ts (pure).
 */

import type { SourceLocation } from '../types.ts';

import { resolveSource, type FiberLike } from './source-location.ts';
import { ISLAND_ID } from './panel.ts';

export interface PropPreview {
  name: string;
  preview: string;
}

export type CardSource = SourceLocation | 'resolving' | null;

export interface InspectCardData {
  componentName: string;
  hostTag: string;
  props: PropPreview[];
  source: CardSource;
}

export interface InspectorPanel {
  setCard(data: InspectCardData | null): void;
  setArmed(armed: boolean): void;
  onToggle(handler: () => void): void;
}

export interface Inspector {
  toggle(): void;
  dispose(): void;
}

/** Reads the React fiber off a DOM node via the `__reactFiber$*` instance key. */
export function getFiberFromElement(element: Element): FiberLike | null {
  const key = Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
  if (!key) {
    return null;
  }
  const fiber: unknown = (element as unknown as Record<string, unknown>)[key];
  // Boundary validation: it must at least look like a fiber before we walk it.
  return typeof fiber === 'object' && fiber !== null && 'type' in fiber
    ? (fiber as FiberLike)
    : null;
}

/** Nearest fiber whose type is a function component, walking up the tree. */
export function findComponentFiber(fiber: FiberLike): FiberLike | null {
  let current: FiberLike | null = fiber;
  for (let depth = 0; current && depth < DEBUG_WALK_LIMIT; depth += 1) {
    if (typeof current.type === 'function') {
      return current;
    }
    current = current.return ?? null;
  }
  return null;
}

const DEBUG_WALK_LIMIT = 25;

/** displayName ?? function name — the spec's component naming rule. */
export function componentNameOf(fiber: FiberLike): string | null {
  if (typeof fiber.type !== 'function') {
    return null;
  }
  const component = fiber.type as { displayName?: unknown; name?: unknown };
  if (typeof component.displayName === 'string' && component.displayName.length > 0) {
    return component.displayName;
  }
  return typeof component.name === 'string' && component.name.length > 0 ? component.name : null;
}

function previewValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'function') {
    return `ƒ ${value.name.length > 0 ? value.name : 'anonymous'}`;
  }
  if (typeof value === 'symbol') {
    return value.description ? `Symbol(${value.description})` : 'Symbol()';
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  // React elements: recognizable by their $typeof marker, previewed as JSX.
  if (typeof value === 'object' && '$typeof' in value) {
    const type = (value as unknown as Record<'type', unknown>).type;
    if (typeof type === 'function' && typeof (type as { name?: unknown }).name === 'string') {
      return `<${(type as { name: string }).name} />`;
    }
    if (typeof type === 'string') {
      return `<${type}>`;
    }
    return '<element>';
  }
  if (typeof value === 'object') {
    const ctor = (value as { constructor?: { name?: unknown } }).constructor;
    if (typeof ctor === 'function' && typeof ctor.name === 'string' && ctor.name !== 'Object') {
      return `${ctor.name} {…}`;
    }
    return '{…}';
  }
  return String(value);
}

/** Shallow props preview — one entry per prop, never deep-serialized. */
export function describeProps(props: unknown): PropPreview[] {
  if (typeof props !== 'object' || props === null) {
    return [];
  }
  return Object.entries(props as Record<string, unknown>).map(([name, value]) => ({
    name,
    preview: previewValue(value),
  }));
}

export function createInspector(panel: InspectorPanel): Inspector {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #ff4785;' +
    'background:rgba(255,71,133,0.10);border-radius:3px;transition:none;display:none;';
  document.body.append(overlay);

  let armed = false;
  let rafHandle = 0;
  let pendingTarget: Element | null = null;
  let hoverToken = 0;

  function setOverlayFor(element: Element | null): void {
    if (!element) {
      overlay.style.display = 'none';
      return;
    }
    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function inspect(target: Element): void {
    const token = ++hoverToken;
    const fiber = getFiberFromElement(target);
    const componentFiber = fiber ? findComponentFiber(fiber) : null;
    const componentName = componentFiber ? componentNameOf(componentFiber) : null;
    if (!componentFiber || !componentName) {
      panel.setCard(null);
      setOverlayFor(null);
      return;
    }
    const props =
      componentFiber.memoizedProps ?? componentFiber.pendingProps ?? componentFiber.props ?? null;
    const card: InspectCardData = {
      componentName,
      hostTag: target.tagName.toLowerCase(),
      props: describeProps(props),
      source: 'resolving',
    };
    panel.setCard(card);
    setOverlayFor(target);

    // Resolve the source asynchronously (regime 2 may need symbolication) and
    // apply the result only if the hover has not moved on.
    void resolveSource(componentFiber, target).then((source) => {
      if (token === hoverToken) {
        panel.setCard({ ...card, source });
      }
    });
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!armed) {
      return;
    }
    // Hovering our own panel is not an inspection target.
    const islandHost = document.getElementById(ISLAND_ID);
    if (islandHost && event.composedPath().includes(islandHost)) {
      return;
    }
    pendingTarget = event.target instanceof Element ? event.target : null;
    if (!rafHandle) {
      rafHandle = requestAnimationFrame(() => {
        rafHandle = 0;
        if (pendingTarget) {
          inspect(pendingTarget);
        }
      });
    }
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.altKey && event.shiftKey && event.code === 'KeyD') {
      event.preventDefault();
      inspector.toggle();
    } else if (event.key === 'Escape' && armed) {
      inspector.toggle();
    }
  }

  const inspector: Inspector = {
    toggle(): void {
      armed = !armed;
      panel.setArmed(armed);
      if (!armed) {
        hoverToken += 1;
        setOverlayFor(null);
        panel.setCard(null);
      }
    },
    dispose(): void {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      overlay.remove();
    },
  };

  document.addEventListener('pointermove', handlePointerMove, true);
  document.addEventListener('keydown', handleKeyDown, true);
  panel.onToggle(() => inspector.toggle());
  return inspector;
}
