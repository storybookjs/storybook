import React, {
  CSSProperties,
  ComponentPropsWithoutRef,
  ElementType,
  JSX,
  MouseEvent,
  ReactNode,
  forwardRef,
} from 'react';

/** Literal union */
export type Size = 'sm' | 'md' | 'lg';

/** String enum */
export enum Tone {
  Neutral = 'neutral',
  Success = 'success',
  Danger = 'danger',
}

/** Tuple example */
export type XY = [x: number, y: number];

/** Discriminated union for “mode” */
export type AsButton =
  | { kind: 'button'; type?: 'button' | 'submit' | 'reset' }
  | { kind: 'link'; href: string; target?: '_blank' | '_self' | '_parent' | '_top' };

/** Discriminated union for loading state */
export type LoadingState =
  | { loading: true; /** Visually hidden label for screen readers */ spinnerLabel: string }
  | { loading: false };

/** Nested object & index signature */
export interface ValidationSchema {
  /** Optional minimum length constraint */
  minLength?: number;
  /** Regex string you could convert to JSON Schema pattern */
  pattern?: string;
  /** Arbitrary dynamic keys (e.g., field-level rules) */
  [fieldName: string]: unknown;
}

/** Mapped type example: string keys to boolean flags */
export type FeatureFlags = Record<string, boolean>;

/** Generic item type used by the component */
export interface Item<TMeta = unknown> {
  id: string;
  label: string;
  meta?: TMeta;
}

/** Polymorphic helper: props for element E without ref */
type PolymorphicProps<E extends ElementType> = {
  /** The element/component to render as */
  as?: E;
} & Omit<ComponentPropsWithoutRef<E>, 'as' | 'children'>;

/**
 * Props for the SmartControl component.
 *
 * @template TMeta - Shape of per-item meta data
 * @template E - The underlying element type for polymorphism
 */
export interface SmartControlProps<TMeta = unknown, E extends ElementType = 'button'>
  extends PolymorphicProps<E> {
  /** Visible content inside the control */
  children?: ReactNode;

  /** Primary label used for accessibility. If omitted, children text should be meaningful. */
  'aria-label'?: string;

  /** Visual size */
  size?: Size;

  /** Semantic tone (maps to style/aria) */
  tone?: Tone;

  /** Inline CSS style passthrough */
  style?: CSSProperties;

  /** Whether the control is disabled (affects both UI and events) */
  disabled?: boolean;

  /** If true, renders a full-width block element */
  block?: boolean;

  /** Optional tooltip text */
  tooltip?: string;

  /** Current loading state (discriminated union) */
  loading?: LoadingState;

  /** Choice of behavior: native button vs. link (discriminated union) */
  asKind?: AsButton;

  /** Optional icon name; empty string disables reserved space */
  icon?: string | null;

  /** Numeric priority; higher = more prominent */
  priority?: 0 | 1 | 2 | 3;

  /** Array example */
  tags?: string[];

  /** Tuple example */
  anchor?: XY;

  /** Items list with generic meta */
  items?: Item<TMeta>[];

  /** Selected item id (must exist in items, if provided) */
  selectedId?: string;

  /** Key/value config blob */
  config?: Record<string, string | number | boolean>;

  /** Validation schema object with index signature */
  validation?: ValidationSchema;

  /** Feature flag bag (mapped type) */
  features?: FeatureFlags;

  /** Click handler example */
  onClick?: (ev: MouseEvent) => void;

  /** Called when selection changes */
  onChangeSelected?: (nextId: string | null) => void;

  /**
   * Email used for audit or attribution.
   *
   * @format email
   * @minLength 5
   */
  auditEmail?: string;

  /**
   * Deprecated prop kept for backward compatibility.
   *
   * @deprecated Use `tone="neutral"` + `priority` instead.
   */
  variant?: 'primary' | 'secondary';

  /**
   * Hidden/internal prop you might want your converter to skip.
   *
   * @internal
   */
  __internalId?: string;

  /**
   * Required example with literal default in implementation.
   *
   * @default 'Smart control'
   */
  label: string;

  /**
   * Runtime constraint example (string with limited set at runtime) Useful to see how you map
   * runtime doc to schema.
   *
   * @enum {'solid' | 'outline' | 'ghost'}
   */
  appearance?: string;
}

/**
 * SmartControl — a polymorphic, accessible, and highly typed component designed to exercise docgen
 * → JSON Schema conversion.
 *
 * @remarks
 * - Polymorphic `as` prop (default: "button")
 * - Discriminated unions: `asKind`, `loading`
 * - Generics: `Item<TMeta>`
 * - JSDoc schema hints: `@format`, `@minLength`, `@deprecated`, `@default`, `@enum`
 * - Index signatures and mapped types
 * - Defaults supplied via parameter defaults
 *
 * @example <SmartControl label="Save" onClick={() => {}}>Save</SmartControl>
 *
 * @example <SmartControl as="a" asKind={{ kind: "link", href: "/docs" }}
 * label="Docs">Open</SmartControl>
 */
export const SmartControl = forwardRef(function SmartControl<
  TMeta = unknown,
  E extends ElementType = 'button',
>(
  {
    as,
    children,
    size = 'md',
    tone = Tone.Neutral,
    disabled = false,
    block = false,
    priority = 0,
    icon = null,
    tags = [],
    anchor,
    items = [],
    selectedId,
    config,
    validation,
    features,
    onClick,
    onChangeSelected,
    auditEmail,
    variant, // deprecated
    __internalId,
    label = 'Smart control',
    appearance = 'solid',
    loading = { loading: false },
    asKind = { kind: 'button', type: 'button' },
    style,
    tooltip,
    'aria-label': ariaLabel,
    ...rest
  }: SmartControlProps<TMeta, E>,
  ref: React.Ref<any>
) {
  const Component = (as ?? 'button') as ElementType;

  const isLink = asKind?.['kind'] === 'link';
  const isButton = asKind?.['kind'] === 'button';

  const resolvedAriaLabel = ariaLabel ?? (typeof children === 'string' ? children : label);

  const handleClick = (ev: MouseEvent) => {
    if (disabled || (loading as LoadingState).loading) {
      ev.preventDefault();
      return;
    }
    onClick?.(ev);
  };

  const className = [
    'smart-control',
    `size-${size}`,
    `tone-${tone}`,
    block ? 'block' : 'inline',
    variant ? `deprecated-${variant}` : null,
    loading?.loading ? 'is-loading' : null,
    `appearance-${appearance}`,
  ]
    .filter(Boolean)
    .join(' ');

  const commonProps = {
    ref,
    'aria-label': resolvedAriaLabel,
    'aria-busy': loading?.loading || undefined,
    'aria-disabled': disabled || undefined,
    title: tooltip,
    className,
    style,
    ...rest,
  };

  if (isLink) {
    const { href, target } = asKind as Extract<AsButton, { kind: 'link' }>;
    return (
      <Component {...commonProps} href={href} target={target} role="link" onClick={handleClick}>
        {children ?? label}
      </Component>
    );
  }

  const { type = 'button' } = asKind as Extract<AsButton, { kind: 'button' }>;

  return (
    <Component {...commonProps} type={type} disabled={disabled} onClick={handleClick}>
      {icon ? <span data-icon={icon} aria-hidden /> : null}
      <span className="content">{children ?? label}</span>
      {loading?.loading ? (
        <span className="spinner" aria-live="polite">
          {loading.spinnerLabel}
        </span>
      ) : null}
      {/* Hidden metadata you might want to exclude from schema */}
      {__internalId ? <input type="hidden" name="__internalId" value={__internalId} /> : null}
      {/* Example usage of items + selectedId to render something */}
      {Array.isArray(items) && items.length > 0 ? (
        <select
          value={selectedId ?? ''}
          onChange={(e) => onChangeSelected?.(e.currentTarget.value || null)}
          aria-label="Select item"
        >
          <option value="">—</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.label}
            </option>
          ))}
        </select>
      ) : null}
    </Component>
  );
}) as <TMeta = unknown, E extends ElementType = 'button'>(
  props: SmartControlProps<TMeta, E> & { ref?: React.Ref<any> }
) => JSX.Element;

/** Named export for consumers/tests */
export default SmartControl;
