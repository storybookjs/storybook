/* eslint-disable react/no-deprecated */
import type { ReactElement } from 'react';
import * as ReactDOM from 'react-dom';

export const renderElement = async (node: ReactElement, el: Element) => {
  return new Promise<null>((resolve) => {
    ReactDOM.render(node, el, () => resolve(null));
  });
};

export const unmountElement = (el: Element) => {
  ReactDOM.unmountComponentAtNode(el);
};
