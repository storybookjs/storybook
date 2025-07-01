import React from 'react';

import PropTypes from 'prop-types';

export const Component = (props) => <>JSON.stringify(props)</>;
Component.propTypes = {
  optionalArray: PropTypes.array,
  arrayOfStrings: PropTypes.arrayOf(PropTypes.string),
  arrayOfShape: PropTypes.arrayOf(
    PropTypes.shape({
      active: PropTypes.bool,
    })
  ),
};
