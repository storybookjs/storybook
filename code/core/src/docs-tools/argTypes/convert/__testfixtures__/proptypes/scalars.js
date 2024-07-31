import React from 'react';
import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  optionalBool: PropTypes.bool,
  optionalFunc: PropTypes.func,
  optionalNumber: PropTypes.number,
  optionalString: PropTypes.string,
  optionalSymbol: PropTypes.symbol,
};
