import React from 'react';

import { imported } from '../imported';

const local = 'local-value';

/** A component that renders its props */
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
