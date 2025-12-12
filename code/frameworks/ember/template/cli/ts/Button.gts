import Component from '@glimmer/component';
import { modifier as createModifier } from 'ember-modifier';
import { on } from '@ember/modifier';
import './button.css';

export interface Signature {
  Element: HTMLButtonElement;
  Args: {
    /** Is this the principal call to action on the page? */
    primary?: boolean;
    /** What background color to use */
    backgroundColor?: string;
    /** How large should the button be? */
    size?: 'small' | 'medium' | 'large';
    /** Button contents */
    label: string;
    onClick(): void;
  };
}

export default class Button extends Component<Signature> {
  backgroundColor = createModifier<{ Element: HTMLElement }>((element) => {
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
