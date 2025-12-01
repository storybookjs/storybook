import type { FC } from 'react';
import React from 'react';

import PropTypes from 'prop-types';

export interface IProps {
  /** Button color */
  color?: string;
}

const iconButton: FC<IProps> = function IconButton() {
  return <div className="icon-button">icon-button</div>;
};

iconButton.propTypes = {
  // deepscan-disable-next-line
  color: PropTypes.string,
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- we can't expect error as it isn't an error in 18 (development) but it is in 19 (sandbox)
// @ts-ignore not present on react 19
iconButton.defaultProps = {
  color: 'primary',
};

export default iconButton;
export const component = iconButton;
