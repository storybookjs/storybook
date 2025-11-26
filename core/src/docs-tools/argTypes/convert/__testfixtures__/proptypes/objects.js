import React from 'react';

import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  optionalObject: PropTypes.object,
  optionalObjectOf: PropTypes.objectOf(PropTypes.number),
  optionalObjectWithShape: PropTypes.shape({
    color: PropTypes.string,
    fontSize: PropTypes.number,
  }),
  optionalObjectWithStrictShape: PropTypes.exact({
    name: PropTypes.string,
    quantity: PropTypes.number,
  }),
};
