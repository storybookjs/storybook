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
  // A CSS-module class name is a string at runtime. We deliberately do NOT type
  // this as `typeof styles`: the CSS module's type shape differs per builder
  // (Vite exposes named exports, Next's css-loader v6 only a default export), so
  // coupling the prop type to it makes docgen/webpack disagree. See the default
  // value below, which reads `styles.foo` purely as a runtime property access.
  myClass?: string;
}

/** A component that renders its props */
export const PropsWriter: React.FC<PropsWriterProps> = (props: PropsWriterProps) => (
  <pre>{JSON.stringify(props)}</pre>
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- we can't expect error as it isn't an error in 18 (development) but it is in 19 (sandbox)
// @ts-ignore not present on react 19
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
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore no types for this
  myClass: styles.foo,
};

export const component = PropsWriter;
