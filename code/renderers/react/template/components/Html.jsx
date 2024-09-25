import React from 'react';

import PropTypes from 'prop-types';

export const Html = ({ content }) => <div dangerouslySetInnerHTML={{ __html: content }} />;

Html.propTypes = {
  content: PropTypes.string.isRequired,
};
