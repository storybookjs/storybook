import React from 'react';

import PropTypes from 'prop-types';

export default class Test extends React.Component {
  static propTypes = {
    /** Please work... */
    test: PropTypes.string,
  };

  render() {
    return <div>test</div>;
  }
}

export const component = Test;
