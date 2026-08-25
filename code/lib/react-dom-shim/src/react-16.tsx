/* oxlint-disable react-classic/no-deprecated -- this shim intentionally targets the legacy react-dom 16 APIs */
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
