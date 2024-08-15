import React from 'react';

import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  // Anything that can be rendered: numbers, strings, elements or an array
  // (or fragment) containing these types.
  optionalNode: PropTypes.node,
  // A React element.
  optionalElement: PropTypes.element,
  // A React element type (ie. MyComponent).
  optionalElementType: PropTypes.elementType,
};
