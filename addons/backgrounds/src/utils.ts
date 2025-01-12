import { global } from '@storybook/global';

const { document, window } = global;

export const isReduceMotionEnabled = () => {
  const prefersReduceMotion = window?.matchMedia('(prefers-reduced-motion: reduce)');
  return !!prefersReduceMotion?.matches;
};

export const clearStyles = (selector: string | string[]) => {
  const selectors = Array.isArray(selector) ? selector : [selector];
  selectors.forEach(clearStyle);
};

const clearStyle = (selector: string) => {
  const element = document.getElementById(selector) as HTMLElement;
  if (element) {
    element.parentElement?.removeChild(element);
  }
};

export const addGridStyle = (selector: string, css: string) => {
  const existingStyle = document.getElementById(selector) as HTMLElement;
  if (existingStyle) {
    if (existingStyle.innerHTML !== css) {
      existingStyle.innerHTML = css;
    }
  } else {
    const style = document.createElement('style') as HTMLElement;
    style.setAttribute('id', selector);
    style.innerHTML = css;
    document.head.appendChild(style);
  }
};

export const addBackgroundStyle = (selector: string, css: string, storyId: string | null) => {
  const existingStyle = document.getElementById(selector) as HTMLElement;
  if (existingStyle) {
    if (existingStyle.innerHTML !== css) {
      existingStyle.innerHTML = css;
    }
  } else {
    const style = document.createElement('style') as HTMLElement;
    style.setAttribute('id', selector);
    style.innerHTML = css;

    const gridStyleSelector = `addon-backgrounds-grid${storyId ? `-docs-${storyId}` : ''}`;
    // If grids already exist, we want to add the style tag BEFORE it so the background doesn't override grid
    const existingGridStyle = document.getElementById(gridStyleSelector) as HTMLElement;
    if (existingGridStyle) {
      existingGridStyle.parentElement?.insertBefore(style, existingGridStyle);
    } else {
      document.head.appendChild(style);
    }
  }
};
