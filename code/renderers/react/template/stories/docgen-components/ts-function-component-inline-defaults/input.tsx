import React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-error (importing a js file)
import { imported } from '../imported';

const local = 'local-value';

enum GlobalNames {
  top = 'top',
  left = 'left',
}

interface PropsWriterProps {
  /**
   * Description
   */
  numberRequired: number;
  numberOptional?: number;
  stringRequired: string;
  stringOptional?: string;
  booleanRequired: boolean;
  booleanOptional?: boolean;
  arrayRequired: string[];
  arrayOptional?: string[];
  objectRequired: Record<string, string>;
  objectOptional?: Record<string, string>;
  functionRequired: () => string;
  functionOptional?: () => string;
  dateRequired: Date;
  dateOptional?: Date;
  localReference?: string;
  importedReference?: string;
  globalReference?: any;
  stringGlobalName?: string;
  unionGlobalName?: 'top' | 'left';
  unionGlobalNameMixed?: 'top' | number;
  enumGlobalName?: GlobalNames;
}

/**
 * A component that renders its props
 */
export const PropsWriter: React.FC<PropsWriterProps> = ({
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
  unionGlobalName = 'top',
  // If we use this default value, controls will try and render it in a JSON object editor
  // which leads to a circular value error.
  // unionGlobalNameMixed = 'top',
  enumGlobalName = 'top',
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
      unionGlobalName,
      // unionGlobalNameMixed,
      enumGlobalName,
    })}
  </pre>
);

export const component = PropsWriter;
