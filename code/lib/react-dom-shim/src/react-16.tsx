/* eslint-disable react/no-deprecated */
import type { ReactElement } from 'react';
import * as ReactDOM from 'react-dom';

import { preventActChecks } from './preventActChecks';

export const renderElement = async (node: ReactElement, el: Element) => {
  return new Promise<null>((resolve) => {
    preventActChecks(() => void ReactDOM.render(node, el, () => resolve(null)));
  });
};

export const unmountElement = (el: Element) => {
  preventActChecks(() => void ReactDOM.unmountComponentAtNode(el));
};
