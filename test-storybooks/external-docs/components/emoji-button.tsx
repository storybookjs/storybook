import React from 'react';
import PropTypes from 'prop-types';

export const EmojiButton = ({ label, ...props }: { label: string }) => (
  <button type="button" {...props}>
    ⚠️ {label}
  </button>
);

EmojiButton.propTypes = {
  /**
   * A label to show on the button
   */
  label: PropTypes.string,
};

EmojiButton.defaultProps = {
  label: 'Hello',
};
