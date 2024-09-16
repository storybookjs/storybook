import React from 'react';

import PropTypes from 'prop-types';

import { imported } from '../imported';

const local = 'local-value';

/** A component that renders its props */

class PropsWriter extends React.Component {
  render() {
    return <pre>{JSON.stringify(this.props)}</pre>;
  }
}

PropsWriter.propTypes = {
  numberRequired: PropTypes.number.isRequired,
  numberOptional: PropTypes.number,
  stringRequired: PropTypes.string.isRequired,
  stringOptional: PropTypes.string,
  booleanRequired: PropTypes.bool.isRequired,
  booleanOptional: PropTypes.bool,
  arrayRequired: PropTypes.arrayOf(PropTypes.string.isRequired).isRequired,
  arrayOptional: PropTypes.arrayOf(PropTypes.string.isRequired),
  objectRequired: PropTypes.shape({}).isRequired,
  objectOptional: PropTypes.shape({}),
  functionRequired: PropTypes.func.isRequired,
  functionOptional: PropTypes.func,
  dateRequired: PropTypes.instanceOf(Date).isRequired,
  dateOptional: PropTypes.instanceOf(Date),
  localReference: PropTypes.string,
  importedReference: PropTypes.string,
  globalReference: PropTypes.any,
  stringGlobalName: PropTypes.string,
};

PropsWriter.defaultProps = {
  numberOptional: 1,
  stringOptional: 'stringOptional',
  booleanOptional: false,
  arrayOptional: ['array', 'optional'],
  objectOptional: { object: 'optional' },
  functionOptional: () => 'foo',
  dateOptional: new Date('20 Jan 1983'),
  localReference: local,
  importedReference: imported,
  globalReference: Date,
  stringGlobalName: 'top',

  stringNoPropType: 'stringNoPropType',
};

export const component = PropsWriter;
