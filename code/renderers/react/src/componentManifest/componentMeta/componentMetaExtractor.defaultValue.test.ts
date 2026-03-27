import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extract } from './componentMetaExtractor.test-helpers';

describe('default value extraction', () => {
  it('extracts destructuring defaults from arrow function', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { size?: string; color?: string; label: string }
        export const Button = ({ size = 'md', color = 'blue', label }: Props) => <button />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        color: { defaultValue: { value: "'blue'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts defaults from forwardRef', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { variant?: string; label: string }
        export const Button = React.forwardRef<HTMLButtonElement, Props>(
          ({ variant = 'primary', label }, ref) => <button ref={ref} />
        );
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        variant: { defaultValue: { value: "'primary'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts JSDoc @default tags', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          /** @default 'md' */
          size?: string;
          label: string;
        }
        export const Button = (props: Props) => <button />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts defaults from body-level destructuring in forwardRef', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; rounded?: boolean; label: string }
        export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
          const { color = 'info', rounded = true, label } = props;
          return <div ref={ref} />;
        });
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: { value: "'info'" } },
        rounded: { defaultValue: { value: 'true' } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts defaults from helper calls that receive props directly', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; rounded?: boolean; label: string }
        const resolveProps = (props: Props) => props;
        export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
          const { color = 'info', rounded = true, label } = resolveProps(props);
          return <div ref={ref} />;
        });
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: { value: "'info'" } },
        rounded: { defaultValue: { value: 'true' } },
        label: { defaultValue: null },
      },
    });
  });

  it('ignores body-level destructuring from unrelated local objects', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; label: string }
        const theme = { color: 'danger' };
        export const Alert = (props: Props) => {
          const { color = 'danger' } = theme;
          return <div data-color={color}>{props.label}</div>;
        };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: null },
        label: { defaultValue: null },
      },
    });
  });

  it('resolves identifier references to literal values', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        const DEFAULT_SIZE = 'md';
        const DEFAULT_COUNT = 42;
        interface Props { size?: string; count?: number; label: string }
        export const Button = ({ size = DEFAULT_SIZE, count = DEFAULT_COUNT, label }: Props) => <button />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        count: { defaultValue: { value: '42' } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts Component.defaultProps expression pattern', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { size?: string; color?: string; label: string }
        export const Button = (props: Props) => <button />;
        Button.defaultProps = { size: 'md', color: 'blue' };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        color: { defaultValue: { value: "'blue'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts static defaultProps from class components', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { size?: string; label: string }
        export class Button extends React.Component<Props> {
          static defaultProps = { size: 'md' };
          render() { return <button />; }
        }
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts @defaultValue tag (alias for @default)', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          /** @defaultValue 'primary' */
          variant?: string;
          label: string;
        }
        export const Button = (props: Props) => <button />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        variant: { defaultValue: { value: "'primary'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts negative number defaults', async () => {
    const entry = await extract(
      'Slider',
      dedent`
        import React from 'react';
        interface Props { min?: number; offset?: number }
        export const Slider = ({ min = -100, offset = -1 }: Props) => <input />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        min: { defaultValue: { value: '-100' } },
        offset: { defaultValue: { value: '-1' } },
      },
    });
  });

  it('extracts null defaults', async () => {
    const entry = await extract(
      'Select',
      dedent`
        import React from 'react';
        interface Props { value?: string | null; label: string }
        export const Select = ({ value = null, label }: Props) => <select />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        value: { defaultValue: { value: 'null' } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts enum member as default value', async () => {
    const entry = await extract(
      'Badge',
      dedent`
        import React from 'react';
        enum Status { Active = 'active', Inactive = 'inactive' }
        interface Props { status?: Status }
        export const Badge = ({ status = Status.Active }: Props) => <span />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        status: { defaultValue: { value: "'active'" } },
      },
    });
  });

  it('extracts shorthand property in defaultProps', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        const size = 'md';
        interface Props { size?: string; label: string }
        export const Button = (props: Props) => <button />;
        Button.defaultProps = { size };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts body-level destructuring through ternary', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; label: string }
        export const Alert = (props: Props) => {
          const isValid = true;
          const { color = 'info', label } = isValid ? props : props;
          return <div />;
        };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: { value: "'info'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts body-level destructuring through nullish coalescing', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; label: string }
        const fallback: Props = { color: 'red', label: '' };
        export const Alert = (props: Props) => {
          const { color = 'info', label } = props ?? fallback;
          return <div />;
        };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: { value: "'info'" } },
        label: { defaultValue: null },
      },
    });
  });

  it('extracts body-level destructuring through nullish coalescing with empty object fallback', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        interface Props { color?: string; label?: string }
        export const Alert = (props: Props) => {
          const { color = 'info', label } = props ?? {};
          return <div />;
        };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        color: { defaultValue: { value: "'info'" } },
        label: { defaultValue: null },
      },
    });
  });

  // Default precedence is intentional: destructuring > defaultProps > JSDoc.
  it('prefers destructuring defaults over JSDoc @default', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          /** @default 'lg' */
          size?: string;
        }
        export const Button = ({ size = 'md' }: Props) => <button />;
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
      },
    });
  });

  it('prefers destructuring defaults over defaultProps', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { size?: string }
        export const Button = ({ size = 'md' }: Props) => <button />;
        Button.defaultProps = { size: 'lg' };
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
      },
    });
  });

  it('extracts defaults from overloaded function component', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { size?: string; label: string }
        export function Button(props: Props): React.ReactElement;
        export function Button({ size = 'md', label }: Props) {
          return <button />;
        }
      `
    );
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: { defaultValue: { value: "'md'" } },
        label: { defaultValue: null },
      },
    });
  });
});
