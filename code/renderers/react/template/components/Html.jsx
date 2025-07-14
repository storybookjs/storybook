import React from 'react';

import PropTypes from 'prop-types';

export const Html = ({ content }) => {
  const contentValue = typeof content === 'function' ? content() : content;
  return <div dangerouslySetInnerHTML={{ __html: contentValue }} />;
};

Html.propTypes = {
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.func]).isRequired,
};
