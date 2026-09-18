import { hbs } from 'ember-cli-htmlbars';

export default {
  title: 'Welcome',
  parameters: {
    options: { showPanel: false },
  },
};

export const Basic = () => ({
  template: hbs`
        {{welcome-page}}
      `,
});
