import { describe, expect, it } from 'vitest';

import { extract } from './componentMetaExtractor.test-helpers';

describe('parent and declaration tracking', () => {
  it('attaches parent type info to props from named interfaces', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        interface ButtonProps {
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    expect(doc.props.label).toMatchObject({
      parent: { name: 'ButtonProps' },
      declarations: [{ name: 'ButtonProps' }],
    });
  });

  it('attaches declarations with TypeLiteral for inline types', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
      `
    );
    expect(doc.props.label).toMatchObject({
      declarations: [{ name: 'TypeLiteral' }],
    });
  });

  it('resolves parent through intersection type literals', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        type BaseProps = { loading?: boolean };
        type ButtonProps = { variant?: string } & BaseProps;
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    expect(doc.props).toMatchObject({
      loading: { parent: { name: 'BaseProps' }, declarations: [{ name: 'TypeLiteral' }] },
      variant: { parent: { name: 'ButtonProps' }, declarations: [{ name: 'TypeLiteral' }] },
    });
  });

  it('resolves parent for forwardRef with polymorphic as-cast', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        type BaseProps = { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>;
        type ButtonProps = { variant?: string } & BaseProps;
        type PolymorphicFC<As extends React.ElementType, P> =
          React.ForwardRefExoticComponent<P & { as?: As } & React.RefAttributes<any>>;
        export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
          (props, ref) => <button ref={ref} />
        ) as PolymorphicFC<'button', ButtonProps>;
      `
    );
    expect(doc.props).toMatchObject({
      as: { parent: { name: 'PolymorphicFC' }, declarations: [{ name: 'TypeLiteral' }] },
      loading: { parent: { name: 'BaseProps' }, declarations: [{ name: 'TypeLiteral' }] },
      variant: { parent: { name: 'ButtonProps' }, declarations: [{ name: 'TypeLiteral' }] },
    });
  });

  it('tracks parent through intersection types', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        interface BaseProps {
          /** Unique identifier */
          id: string;
        }
        interface StyleProps {
          /** Custom CSS class */
          className?: string;
        }
        type ButtonProps = BaseProps & StyleProps & {
          /** The label */
          label: string;
        };
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    expect(doc.props).toMatchObject({
      id: { parent: { name: 'BaseProps' }, declarations: [{ name: 'BaseProps' }] },
      className: { parent: { name: 'StyleProps' }, declarations: [{ name: 'StyleProps' }] },
      label: { parent: { name: 'ButtonProps' }, declarations: [{ name: 'TypeLiteral' }] },
    });
  });

  it('tracks parent through extends', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        interface BaseProps {
          /** Unique identifier */
          id: string;
        }
        interface ButtonProps extends BaseProps {
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    expect(doc.props).toMatchObject({
      id: { parent: { name: 'BaseProps' }, declarations: [{ name: 'BaseProps' }] },
      label: { parent: { name: 'ButtonProps' }, declarations: [{ name: 'ButtonProps' }] },
    });
  });

  it('tracks declarations from multiple sources', async () => {
    const doc = await extract(
      'Comp',
      `
        import React from 'react';
        interface A { shared: string }
        interface B { shared: string }
        type Props = A & B;
        export const Comp = (props: Props) => <div />;
      `
    );
    expect(doc.props.shared).toMatchObject({
      parent: { name: 'A' },
      declarations: [{ name: 'A' }, { name: 'B' }],
    });
  });

  it('filters out HTML attributes when declaration file contributes >30 props', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          /** Custom variant */
          variant: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    expect(Object.keys(doc.props)).toEqual(['variant']);
    expect(doc.props.variant).toMatchObject({
      parent: { name: 'ButtonProps' },
      declarations: [{ name: 'ButtonProps' }],
    });
  });

  it('sets source fileName on declarations for >30 filter', async () => {
    const doc = await extract(
      'Button',
      `
        import React from 'react';
        interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          /** Custom variant */
          variant: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );
    // variant survives the filter and has a fileName on its declaration
    expect(doc.props.variant.parent?.fileName).toBeDefined();
    expect(doc.props.variant.declarations?.[0]?.fileName).toBeDefined();

    // HTML attributes from ButtonHTMLAttributes are filtered out (>30 props)
    expect(doc.props.onClick).toBeUndefined();
    expect(doc.props.className).toBeUndefined();
  });
});
