import Component from '@glimmer/component';
import { modifier as createModifier } from 'ember-modifier';
import { on } from '@ember/modifier';
import './button.css';

export default class Button extends Component {
  backgroundColor = createModifier((element) => {
    element.style.backgroundColor = this.args.backgroundColor ?? '';
  });

  get className() {
    let mode = this.args.primary
      ? 'storybook-button--primary'
      : 'storybook-button--secondary';
    return [
      'storybook-button',
      `storybook-button--${this.args.size}`,
      mode,
    ].join(' ');
  }

  <template>
    <button
      {{on "click" @onClick}}
      type="button"
      class={{this.className}}
      {{this.backgroundColor}}
    >
      {{@label}}
    </button>
  </template>
}
