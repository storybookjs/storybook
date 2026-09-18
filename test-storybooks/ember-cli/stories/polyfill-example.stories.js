import { hbs } from 'ember-cli-htmlbars';

export default {
  title: 'EmberOptions/Polyfills',
};

export const NamedBlockExample = () => {
  return {
    template: hbs`
      <NamedBlock
      >
        <:title>This article is awesome!</:title>
        <:body>
          My blog has very awesome content, and everyone should
          read it.
        </:body>
      </NamedBlock>
  `,
  };
};
