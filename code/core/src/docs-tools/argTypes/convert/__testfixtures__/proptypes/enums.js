import React from 'react';
import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  oneOfNumber: PropTypes.oneOf([1, 2, 3]),
  oneOfMiscellaneous: PropTypes.oneOf([false, true, undefined]),
  oneOfStringNumber: PropTypes.oneOf(['1', '2', '3']),
  oneOfString: PropTypes.oneOf(['static', 'timed']),
};
