import { FASTElement, attr, customElement, html, observable } from '@microsoft/fast-element';

const template = html<FastAttributes>`<button ?disabled=${(x) => x.disabled}>
  ${(x) => x.label}
</button>`;

/**
 * A FAST button with attribute and observable fields.
 *
 * @fires {CustomEvent<number>} fast-count-change - Emitted after every click with the new count.
 */
@customElement({ name: 'fast-attributes', template })
export class FastAttributes extends FASTElement {
  /** Visible label. */
  @attr
  label = 'Go';

  /** Button size. */
  @attr
  size: 'small' | 'large' = 'small';

  /** Disables the button (boolean attribute). */
  @attr({ mode: 'boolean' })
  disabled = false;

  /** Upper bound for the counter; attribute name differs from the field. */
  @attr({ attribute: 'max-count', converter: { fromView: Number, toView: String } })
  maxCount = 3;

  /** Property only, never reflected. */
  @observable
  items: string[] = [];

  /** Current click count. */
  count = 0;

  /** Increments the counter and fires `fast-count-change`. */
  increment(): void {
    this.count = Math.min(this.count + 1, this.maxCount);
    this.$emit('fast-count-change', this.count);
  }
}
