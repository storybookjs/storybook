import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';

export type Size = 'small' | 'medium' | 'large';

/**
 * Exercises the shapes the wc-toolkit helpers special-case.
 *
 * @slot - Default content.
 * @slot label - Rich label content; collides with the `label` attribute.
 * @csspart base - The wrapper.
 * @cssprop {<color>} --toolkit-color - Text color.
 * @cssprop {<number>} --toolkit-scale - Scale factor.
 * @cssprop --toolkit-font - Font shorthand.
 * @cssproperty [--toolkit-gap=4px] - Gap with a default.
 * @cssstate active - Set while active.
 * @fires {CustomEvent<{ size: Size }>} toolkit-resize - Fired when the size changes.
 * @fires click - Native click passthrough.
 */
export class LitToolkitShapes extends LitElement {
  /** Named alias union. */
  @property()
  size: Size = 'medium';

  /** Inline literal union with a numeric member. */
  @property({ type: Number })
  level: 1 | 2 | 3 = 1;

  /** Array of literals. */
  @property({ type: Array })
  tags: Array<'a' | 'b'> = ['a'];

  /** Mixed literal/object union. */
  @property({ type: Object })
  target: 'self' | { id: string } = 'self';

  /** Plain label; collides with the `label` slot. */
  @property()
  label = 'Label';

  /** Date value. */
  @property({ type: Object })
  when: Date = new Date(0);

  /** Read-only computed value. */
  get computed(): string {
    return `${this.size}-${this.level}`;
  }

  /** Readonly field. */
  readonly version = '1.0.0';

  /** Static member, excluded. */
  static readonly tagName = 'lit-toolkit-shapes';

  /** Private field, excluded. */
  private internalCounter = 0;

  /** Protected field, excluded. */
  protected helper = 'h';

  /** ES private, excluded. */
  #secret = 's';

  /** Internal reactive state. */
  @state()
  pressed = false;

  /**
   * Old size field.
   *
   * @deprecated Use `size` instead.
   */
  @property({ attribute: 'old-size' })
  oldSize = '';

  /** Callback property. */
  @property({ attribute: false })
  onSelect: ((size: Size) => void) | undefined = undefined;

  /** Public method with params. */
  focusItem(index: number, options?: { smooth: boolean }): boolean {
    return index >= 0 && Boolean(options);
  }

  /** Private method, excluded. */
  private tick(): void {
    this.internalCounter += 1;
  }

  render() {
    return html`<div part="base"><slot name="label">${this.label}</slot><slot></slot></div>`;
  }
}

if (!customElements.get('lit-toolkit-shapes')) {
  customElements.define('lit-toolkit-shapes', LitToolkitShapes);
}
