import { LitElement, css, html, nothing } from 'lit';

/**
 * A counter that exposes every Custom Elements Manifest category the default render binds.
 *
 * @fires count-changed - Fires after the count changes, with the new count as `detail.count`
 * @slot - Label shown next to the value
 * @slot prefix - Content rendered before the label
 * @cssprop {<color>} [--demo-wc-counter-accent=rgb(0, 95, 204)] - Background of the increment button
 * @cssprop {<number>} [--demo-wc-counter-badge-opacity=1] - Opacity of the badges
 * @csspart badge - A badge rendered next to the current count
 * @csspart button - The increment button
 * @csspart deadline - The deadline, when set
 * @csspart value - The current count
 * @cssstate at-max - Set while the count has reached `max`
 */
export class DemoWcCounter extends LitElement {
  static properties = {
    count: { type: Number, reflect: true },
    step: { type: Number },
    max: { type: Number },
    disabled: { type: Boolean, reflect: true },
    size: { type: String, reflect: true },
    tone: { type: String, reflect: true },
    label: { type: String },
    badges: { attribute: false },
    unit: { attribute: false },
    deadline: { attribute: false },
  };

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: sans-serif;
    }

    button {
      border: none;
      border-radius: 4px;
      padding: 4px 12px;
      color: white;
      background: var(--demo-wc-counter-accent, rgb(0, 95, 204));
      cursor: pointer;
    }

    :host([tone='success']) [part='value'] {
      color: rgb(0, 128, 0);
    }

    :host([tone='danger']) [part='value'] {
      color: rgb(220, 20, 60);
    }

    [part='badge'] {
      opacity: var(--demo-wc-counter-badge-opacity, 1);
    }

    :host([size='small']) button {
      font-size: 12px;
      padding: 2px 8px;
    }

    :host([size='large']) button {
      font-size: 20px;
      padding: 8px 16px;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  #internals = this.attachInternals();

  constructor() {
    super();

    /** Current value */
    this.count = 0;

    /** Amount added on every increment */
    this.step = 1;

    /** Highest value the counter can reach */
    this.max = 10;

    /** Prevents incrementing */
    this.disabled = false;

    /**
     * Button size
     *
     * @type {'small' | 'medium' | 'large'}
     */
    this.size = 'medium';

    /**
     * Color of the value
     *
     * @type {'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand'}
     */
    this.tone = 'neutral';

    /** Accessible name of the increment button */
    this.label = 'Increment';

    /**
     * Badges shown after the value, only settable as a property
     *
     * @type {Array<'new' | 'hot' | 'sale'>}
     */
    this.badges = [];

    /**
     * Words used after the value, only settable as a property
     *
     * @type {{ singular: string, plural: string }}
     */
    this.unit = { singular: 'click', plural: 'clicks' };

    /**
     * Date shown after the value, only settable as a property
     *
     * @type {Date}
     */
    this.deadline = undefined;
  }

  /** Whether the count has reached `max` */
  get atMax() {
    return this.count >= this.max;
  }

  /** Adds `step` to the count, up to `max` */
  increment() {
    if (this.disabled || this.atMax) {
      return;
    }
    this.count = Math.min(this.count + this.step, this.max);
    this.dispatchEvent(new CustomEvent('count-changed', { detail: { count: this.count } }));
  }

  updated() {
    if (this.atMax) {
      this.#internals.states.add('at-max');
    } else {
      this.#internals.states.delete('at-max');
    }
  }

  render() {
    const unit = this.count === 1 ? this.unit.singular : this.unit.plural;
    return html`
      <slot name="prefix"></slot>
      <slot></slot>
      <span part="value">${this.count} ${unit}</span>
      ${this.badges.map((badge) => html`<span part="badge">${badge}</span>`)}
      ${
        this.deadline === undefined
          ? nothing
          : html`<time part="deadline">${new Date(this.deadline).toISOString().slice(0, 10)}</time>`
      }
      <button
        part="button"
        aria-label=${this.label}
        ?disabled=${this.disabled || this.atMax}
        @click=${this.increment}
      >
        +${this.step}
      </button>
    `;
  }
}
