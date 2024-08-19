import React from 'react';

import PropTypes from 'prop-types';

const CCTable = (props) => <>{JSON.stringify(props)}</>;
CCTable.propTypes = {
  heads: PropTypes.array.isRequired,
  onAddClick: PropTypes.func,
};

export const component = CCTable;
