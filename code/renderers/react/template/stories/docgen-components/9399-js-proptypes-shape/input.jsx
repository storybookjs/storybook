import React from 'react';

import PropTypes from 'prop-types';

export const Credits = ({ areas }) => <>{JSON.stringify(areas)}</>;

// https://github.com/storybookjs/storybook/issues/9399
Credits.propTypes = {
  areas: PropTypes.arrayOf(
    PropTypes.shape({
      position: PropTypes.string.isRequired,
      names: PropTypes.arrayOf(PropTypes.string).isRequired,
    })
  ).isRequired,
};

export const component = Credits;
