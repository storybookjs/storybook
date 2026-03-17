import { describe, expect, it } from 'vitest';

import { extract } from './componentMetaExtractor.test-helpers';

describe('default value extraction', () => {
  it('extracts destructuring defaults from arrow function', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { size?: string; color?: string; label: string }
      export const Button = ({ size = 'md', color = 'blue', label }: Props) => <button />;
    `
    );
    expect(doc.props).toMatchObject({
      size: { defaultValue: { value: "'md'" } },
      color: { defaultValue: { value: "'blue'" } },
      label: { defaultValue: null },
    });
  });

  it('extracts defaults from forwardRef', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { variant?: string; label: string }
      export const Button = React.forwardRef<HTMLButtonElement, Props>(
        ({ variant = 'primary', label }, ref) => <button ref={ref} />
      );
    `
    );
    expect(doc.props).toMatchObject({
      variant: { defaultValue: { value: "'primary'" } },
      label: { defaultValue: null },
    });
  });

  it('extracts JSDoc @default tags', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props {
        /** @default 'md' */
        size?: string;
        label: string;
      }
      export const Button = (props: Props) => <button />;
    `
    );
    expect(doc.props).toMatchObject({
      size: { defaultValue: { value: "'md'" } },
      label: { defaultValue: null },
    });
  });

  it('extracts defaults from body-level destructuring in forwardRef', () => {
    const doc = extract(
      'Alert',
      `
      import React from 'react';
      interface Props { color?: string; rounded?: boolean; label: string }
      export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
        const { color = 'info', rounded = true, label } = props;
        return <div ref={ref} />;
      });
    `
    );
    expect(doc.props).toMatchObject({
      color: { defaultValue: { value: "'info'" } },
      rounded: { defaultValue: { value: 'true' } },
      label: { defaultValue: null },
    });
  });

  it('extracts defaults from helper calls that receive props directly', () => {
    const doc = extract(
      'Alert',
      `
      import React from 'react';
      interface Props { color?: string; rounded?: boolean; label: string }
      const resolveProps = (props: Props) => props;
      export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
        const { color = 'info', rounded = true, label } = resolveProps(props);
        return <div ref={ref} />;
      });
    `
    );
    expect(doc.props).toMatchObject({
      color: { defaultValue: { value: "'info'" } },
      rounded: { defaultValue: { value: 'true' } },
      label: { defaultValue: null },
    });
  });

  it('ignores body-level destructuring from unrelated local objects', () => {
    const doc = extract(
      'Alert',
      `
      import React from 'react';
      interface Props { color?: string; label: string }
      const theme = { color: 'danger' };
      export const Alert = (props: Props) => {
        const { color = 'danger' } = theme;
        return <div data-color={color}>{props.label}</div>;
      };
    `
    );
    expect(doc.props).toMatchObject({
      color: { defaultValue: null },
      label: { defaultValue: null },
    });
  });

  it('resolves identifier references to literal values', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      const DEFAULT_SIZE = 'md';
      const DEFAULT_COUNT = 42;
      interface Props { size?: string; count?: number; label: string }
      export const Button = ({ size = DEFAULT_SIZE, count = DEFAULT_COUNT, label }: Props) => <button />;
    `
    );
    expect(doc.props).toMatchObject({
      size: { defaultValue: { value: "'md'" } },
      count: { defaultValue: { value: '42' } },
      label: { defaultValue: null },
    });
  });

  it('extracts Component.defaultProps expression pattern', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { size?: string; color?: string; label: string }
      export const Button = (props: Props) => <button />;
      Button.defaultProps = { size: 'md', color: 'blue' };
    `
    );
    expect(doc.props).toMatchObject({
      size: { defaultValue: { value: "'md'" } },
      color: { defaultValue: { value: "'blue'" } },
      label: { defaultValue: null },
    });
  });

  it('extracts static defaultProps from class components', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { size?: string; label: string }
      export class Button extends React.Component<Props> {
        static defaultProps = { size: 'md' };
        render() { return <button />; }
      }
    `
    );
    expect(doc.props).toMatchObject({
      size: { defaultValue: { value: "'md'" } },
      label: { defaultValue: null },
    });
  });
});
