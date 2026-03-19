/* eslint-env browser */
import {
  DOCS_RENDERED,
  FORCE_REMOUNT,
  FORCE_RE_RENDER,
  GLOBALS_UPDATED,
  STORY_CHANGED,
  STORY_RENDERED,
  UPDATE_GLOBALS,
} from 'storybook/internal/core-events';
import type { DecoratorFunction } from 'storybook/internal/types';

import { addons, useEffect, useMemo, useRef } from 'storybook/preview-api';

import { PSEUDO_STATES } from '../constants';
import type { PseudoParameter, PseudoState, PseudoStateConfig } from '../types';
import { rewriteStyleSheet } from './rewriteStyleSheet';

const channel = addons.getChannel();
const shadowHosts = new Set<Element>();

// Drops any existing pseudo state classnames that carried over from a previously viewed story
// before adding the new classnames. We use forEach for IE compatibility.
const applyClasses = (element: Element, classnames: Set<string>) => {
  Object.values(PSEUDO_STATES).forEach((state) => {
    element.classList.remove(`pseudo-${state}`);
    element.classList.remove(`pseudo-${state}-all`);
  });
  classnames.forEach((classname) => element.classList.add(classname));
};

function querySelectorPiercingShadowDOM(root: Element | ShadowRoot, selector: string) {
  const results: Element[] = [];
  root.querySelectorAll('*').forEach((el) => {
    if (el.shadowRoot) {
      results.push(...querySelectorPiercingShadowDOM(el.shadowRoot, selector));
    }
  });
  results.push(...root.querySelectorAll(selector).values());
  return results;
}

const applyParameter = (rootElement: Element, parameter: PseudoStateConfig = {}) => {
  const map = new Map([[rootElement, new Set<PseudoState>()]]);
  const add = (target: Element, state: PseudoState) =>
    map.set(target, new Set([...(map.get(target) || []), state]));

  (Object.entries(parameter || {}) as [PseudoState, any]).forEach(([state, value]) => {
    if (typeof value === 'boolean') {
      // default API - applying pseudo class to root element.
      if (value) {
        add(rootElement, `${state}-all` as PseudoState);
      }
    } else if (typeof value === 'string') {
      // explicit selectors API - applying pseudo class to a specific element
      querySelectorPiercingShadowDOM(rootElement, value).forEach((el) => add(el, state));
    } else if (Array.isArray(value)) {
      // explicit selectors API - we have an array (of strings) recursively handle each one
      value.forEach((sel) =>
        querySelectorPiercingShadowDOM(rootElement, sel).forEach((el) => add(el, state))
      );
    }
  });

  map.forEach((states, target) => {
    const classnames = new Set<string>();
    states.forEach((key) => {
      const keyWithoutAll = key.replace('-all', '') as PseudoState;
      if (PSEUDO_STATES[key]) {
        classnames.add(`pseudo-${PSEUDO_STATES[key]}`);
      } else if (PSEUDO_STATES[keyWithoutAll]) {
        classnames.add(`pseudo-${PSEUDO_STATES[keyWithoutAll]}-all`);
      }
    });
    applyClasses(target, classnames);
  });
};

// Traverses ancestry to collect relevant pseudo classnames, and applies them to the shadow host.
// Shadow DOM can only access classes on its host. Traversing is needed to mimic the CSS cascade.
const updateShadowHost = (shadowHost: Element) => {
  const classnames = new Set<string>();
  // Keep any existing "pseudo-*" classes (but not "pseudo-*-all").
  // "pseudo-*-all" classes may be stale and will be re-added as needed.
  shadowHost.className
    .split(' ')
    .filter((classname) => classname.match(/^pseudo-(.(?!-all))+$/))
    .forEach((classname) => classnames.add(classname));
  // Adopt "pseudo-*-all" classes from ancestors (across shadow boundaries)
  for (let node = shadowHost.parentNode; node; ) {
    if (node instanceof ShadowRoot) {
      node = node.host;
      continue;
    }
    if (node instanceof Element) {
      const element = node;
      if (element.className) {
        element.className
          .split(' ')
          .filter((classname) => classname.match(/^pseudo-.+-all$/) !== null)
          .forEach((classname) => classnames.add(classname));
      }
    }
    node = node.parentNode;
  }
  applyClasses(shadowHost, classnames);
};

// Drops the rootSelector from the parameter object, as it is not a pseudo state.
const pseudoConfig = (parameter: PseudoParameter) => {
  const { rootSelector, ...pseudoStateConfig } = parameter || {};
  return pseudoStateConfig;
};

// Compares two pseudo state configs to see if they are equal.
// Uses JSON.stringify to handle arrays, so the order of selectors in the array matters.
const equals = (a: PseudoStateConfig = {}, b: PseudoStateConfig = {}) =>
  a !== null &&
  b !== null &&
  Object.keys(a).length === Object.keys(b).length &&
  (Object.keys(a) as PseudoState[]).every(
    (key) => JSON.stringify(a[key]) === JSON.stringify(b[key])
  );

// Global decorator that rewrites stylesheets and applies classnames to render pseudo styles
export const withPseudoState: DecoratorFunction = (
  StoryFn,
  { viewMode, parameters, id, globals: globalsArgs }
) => {
  const { pseudo: parameter } = parameters;
  const { pseudo: globals } = globalsArgs;
  const { rootSelector } = parameter || {};

  const rootElement = useMemo(() => {
    if (rootSelector) {
      return document.querySelector(rootSelector);
    }
    if (viewMode === 'docs') {
      return document.getElementById(`story--${id}`);
    }
    return (
      document.getElementById('storybook-root') || // Storybook 7.0+
      document.getElementById('root')
    );
  }, [rootSelector, viewMode, id]);

  // Use a ref to avoid a dependency on globals in the useEffect
  const globalsRef = useRef(globals);

  // Sync parameter to globals, used by the toolbar (only in canvas as this
  // doesn't make sense for docs because many stories are displayed at once)
  useEffect(() => {
    const config = pseudoConfig(parameter);
    if (viewMode === 'story' && !equals(config, globalsRef.current)) {
      channel.emit(UPDATE_GLOBALS, {
        globals: { pseudo: config },
      });
    }
  }, [parameter, viewMode]);

  // Convert selected states to classnames and apply them to the story root element.
  // Then update each shadow host to redetermine its own pseudo classnames.
  useEffect(() => {
    if (!rootElement) {
      return;
    }
    const timeout = setTimeout(() => {
      applyParameter(rootElement, globals || pseudoConfig(parameter));
      shadowHosts.forEach(updateShadowHost);
    }, 0);
    return () => clearTimeout(timeout);
  }, [rootElement, globals, parameter]);

  return StoryFn();
};

// Rewrite CSS rules for pseudo-states on all stylesheets to add an alternative selector
const rewriteStyleSheets = (shadowRoot?: ShadowRoot) => {
  let styleSheets = Array.from(shadowRoot ? shadowRoot.styleSheets : document.styleSheets);

  if (shadowRoot?.adoptedStyleSheets?.length) {
    styleSheets = shadowRoot.adoptedStyleSheets;
  }
  styleSheets.forEach((sheet) => rewriteStyleSheet(sheet, !!shadowRoot));

  if (shadowRoot && shadowHosts) {
    shadowHosts.add(shadowRoot.host);
  }
};

// Only track shadow hosts for the current story
channel.on(STORY_CHANGED, () => shadowHosts.clear());

// Reinitialize CSS enhancements every time the story changes
channel.on(STORY_RENDERED, () => rewriteStyleSheets());
channel.on(GLOBALS_UPDATED, () => rewriteStyleSheets());
channel.on(FORCE_RE_RENDER, () => rewriteStyleSheets());
channel.on(FORCE_REMOUNT, () => rewriteStyleSheets());

// Reinitialize CSS enhancements every time a docs page is rendered
channel.on(DOCS_RENDERED, () => rewriteStyleSheets());

// IE doesn't support shadow DOM
if (Element.prototype.attachShadow) {
  // Monkeypatch the attachShadow method so we can handle pseudo styles inside shadow DOM
  // @ts-expect-error (Monkeypatch)
  Element.prototype._attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(init) {
    // Force "open" mode, so we can access the shadowRoot
    // @ts-expect-error (Monkeypatch)
    const shadowRoot = this._attachShadow({ ...init, mode: 'open' });
    // Wait for it to render and apply its styles before rewriting them
    requestAnimationFrame(() => {
      rewriteStyleSheets(shadowRoot);

      if (shadowHosts.has(shadowRoot.host)) {
        updateShadowHost(shadowRoot.host);
      }
    });
    return shadowRoot;
  };
}
