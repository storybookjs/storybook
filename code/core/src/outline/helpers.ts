import { global } from '@storybook/global';

export const clearStyles = (selector: string | string[]) => {
  const selectors = Array.isArray(selector) ? selector : [selector];
  selectors.forEach(clearStyle);
};

const clearStyle = (input: string | string[]) => {
  if (!global.document) {
    return;
  }

  const selector = typeof input === 'string' ? input : input.join('');
  const element = global.document.getElementById(selector);
  if (element && element.parentElement) {
    element.parentElement.removeChild(element);
  }
};

// The style is a child of <html>, outside <head> and <body>: the renderer of a story with layout
// 'document' may replace the body, and remove what was added to <head> while it renders. Each use
// finds the style by id, and adds it again when a render removed it.
export const addOutlineStyles = (selector: string, css: string) => {
  if (!global.document) {
    return;
  }

  const existingStyle = global.document.getElementById(selector);
  if (existingStyle) {
    if (existingStyle.innerHTML !== css) {
      existingStyle.innerHTML = css;
    }
  } else {
    const style = global.document.createElement('style');
    style.setAttribute('id', selector);
    style.innerHTML = css;
    global.document.documentElement.appendChild(style);
  }
};
