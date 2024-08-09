import React from 'react';

import PropTypes from 'prop-types';

const Alert = (props) => <>{JSON.stringify(props)}</>;

Alert.defaultProps = {
  mode: 'static',
  type: 'warning',
};

Alert.propTypes = {
  mode: PropTypes.oneOf(['static', 'timed']),
  type: PropTypes.oneOf(['success', 'warning', 'error', 'primary']),
  message: PropTypes.string.isRequired,
  /**
   * No background or border if static alert
   */
  blank: PropTypes.bool,
  /**
   * Allows icon override, accepts material icon name
   */
  icon: PropTypes.string,
};

export const component = Alert;
