import React from 'react';

import { imported } from '../imported';

const local = 'local-value';

/**
 * A component that renders its props
 *
 * @param {object} props
 * @param {number} props.numberRequired Description
 * @param {number} [props.numberOptional]
 * @param {string} props.stringRequired
 * @param {string} [props.stringOptional]
 * @param {boolean} props.booleanRequired
 * @param {boolean} [props.booleanOptional]
 * @param {string[]} props.arrayRequired
 * @param {string[]} [props.arrayOptional]
 * @param {object} props.objectRequired
 * @param {object} [props.objectOptional]
 * @param {() => string} props.functionRequired
 * @param {() => string} [props.functionOptional]
 * @param {Date} props.dateRequired
 * @param {Date} [props.dateOptional]
 * @param {string} [props.localReference]
 * @param {string} [props.importedReference]
 * @param {*} [props.globalReference]
 * @param {string} [props.stringGlobalName]
 */
export const PropsWriter = ({
  numberOptional = 1,
  stringOptional = 'stringOptional',
  booleanOptional = false,
  arrayOptional = ['array', 'optional'],
  objectOptional = { object: 'optional' },
  functionOptional = () => 'foo',
  dateOptional = new Date('20 Jan 1983'),
  localReference = local,
  importedReference = imported,
  globalReference = Date,
  stringGlobalName = 'top',
}) => (
  <pre>
    {JSON.stringify({
      numberOptional,
      stringOptional,
      booleanOptional,
      arrayOptional,
      objectOptional,
      functionOptional,
      dateOptional,
      localReference,
      importedReference,
      globalReference,
      stringGlobalName,
    })}
  </pre>
);

export const component = PropsWriter;
