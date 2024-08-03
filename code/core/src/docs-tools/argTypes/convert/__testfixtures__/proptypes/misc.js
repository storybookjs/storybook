import React from 'react';
import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  // An object that could be one of many types
  optionalUnion: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.instanceOf(Object),
  ]),
  optionalMessage: PropTypes.instanceOf(Object),
  // A value of any data type
  requiredAny: PropTypes.any.isRequired,
};
