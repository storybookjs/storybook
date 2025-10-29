import Component from '@glimmer/component';
import {tracked} from '@glimmer/tracking';
import {on} from '@ember/modifier';

export default class Form extends Component {
  @tracked complete = false;
  @tracked value = '';

  onChange = (event) => {
    this.value = event.currentTarget.value;
  };

  onSubmit = (event) => {
    event.preventDefault();
    this.args.onSuccess(this.value);

    setTimeout(() => { this.complete = true; }, 500);
    setTimeout(() =>  { this.complete = false; }, 1500);
  };

  <template>
    <form id="interaction-test-form" {{on "submit" this.onSubmit}}>
      <label>
        Enter Value
        <input
          type="text"
          data-testid="value"
          value={{this.value}}
          required
          {{on "change" this.onChange}}
        />
      </label>
      <button type="submit">Submit</button>
      {{#if this.complete}}
        <p>Completed!!</p>
      {{/if}}
    </form>
  </template>
}
