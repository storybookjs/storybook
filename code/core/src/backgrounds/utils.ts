const { document } = globalThis;

export const isReduceMotionEnabled = () => {
  if (!globalThis?.matchMedia) {
    return false;
  }
  const prefersReduceMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  return !!prefersReduceMotion?.matches;
};

export const clearStyles = (selector: string | string[]) => {
  const selectors = Array.isArray(selector) ? selector : [selector];
  selectors.forEach(clearStyle);
};

const clearStyle = (selector: string) => {
  if (!document) {
    return;
  }

  const element = document.getElementById(selector);
  if (element && element.parentElement) {
    element.parentElement.removeChild(element);
  }
};

// The styles are children of <html>, outside <head> and <body>: the renderer of a story with layout
// 'document' may replace the body, and remove what was added to <head> while it renders. Each use
// finds its style by id, and adds it again when a render removed it.
export const addGridStyle = (selector: string, css: string) => {
  if (!document) {
    return;
  }

  const existingStyle = document.getElementById(selector);
  if (existingStyle) {
    if (existingStyle.innerHTML !== css) {
      existingStyle.innerHTML = css;
    }
  } else {
    const style = document.createElement('style');
    style.setAttribute('id', selector);
    style.innerHTML = css;
    document.documentElement.appendChild(style);
  }
};

export const addBackgroundStyle = (selector: string, css: string, storyId: string | null) => {
  if (!document) {
    return;
  }

  const existingStyle = document.getElementById(selector);
  if (existingStyle) {
    if (existingStyle.innerHTML !== css) {
      existingStyle.innerHTML = css;
    }
  } else {
    const style = document.createElement('style');
    style.setAttribute('id', selector);
    style.innerHTML = css;

    const gridStyleSelector = `addon-backgrounds-grid${storyId ? `-docs-${storyId}` : ''}`;
    // If grids already exist, we want to add the style tag BEFORE it so the background doesn't override grid
    const existingGridStyle = document.getElementById(gridStyleSelector);
    if (existingGridStyle) {
      existingGridStyle.parentElement?.insertBefore(style, existingGridStyle);
    } else {
      document.documentElement.appendChild(style);
    }
  }
};
