import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';

type Constructor<T = object> = new (...args: any[]) => T;

export class BaseElement extends LitElement {
  /** Label inherited from the base class. */
  @property({ attribute: 'base-label' })
  baseLabel = 'Base';
}

const SelectableMixin = <T extends Constructor<LitElement>>(Base: T) => {
  class SelectableElement extends Base {
    /** Whether the mixed-in state is active. */
    mixedActive = false;

    static properties = {
      mixedActive: { attribute: 'mixed-active', type: Boolean },
    };
  }

  return SelectableElement as Constructor<LitElement & { mixedActive: boolean }> & T;
};

const SelectableBase = SelectableMixin(BaseElement);

/** Element composed from a base class and a mixin. */
export class LitInheritanceMixin extends SelectableBase {
  declare baseLabel: string;
  declare mixedActive: boolean;

  /** Count declared by the final class. */
  @property({ type: Number })
  count = 1;

  render() {
    return html`<p>${this.baseLabel} ${this.mixedActive} ${this.count}</p>`;
  }
}

if (!customElements.get('lit-inheritance-mixin')) {
  customElements.define('lit-inheritance-mixin', LitInheritanceMixin);
}
