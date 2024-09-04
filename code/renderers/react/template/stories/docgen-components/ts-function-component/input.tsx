import React from 'react';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (js import not supported in TS)
import { imported } from '../imported';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore (css import not supported in TS)
import styles from '../imported.module.css';

const local = 'local-value';

interface PropsWriterProps {
  /** Description */
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
  myClass: typeof styles.foo;
}

/** A component that renders its props */
export const PropsWriter: React.FC<PropsWriterProps> = (props: PropsWriterProps) => (
  <pre>{JSON.stringify(props)}</pre>
);

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
  myClass: styles.foo,
};

export const component = PropsWriter;
