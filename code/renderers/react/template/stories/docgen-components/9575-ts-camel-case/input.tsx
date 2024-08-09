import type { FC } from 'react';
import React from 'react';

import PropTypes from 'prop-types';

export interface IProps {
  /**
   * button color
   */
  color?: string;
}

const iconButton: FC<IProps> = function IconButton(props) {
  return <div className="icon-button">icon-button</div>;
};

iconButton.propTypes = {
  // deepscan-disable-next-line
  color: PropTypes.string,
};

iconButton.defaultProps = {
  color: 'primary',
};

export default iconButton;
export const component = iconButton;
