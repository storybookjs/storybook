import { hbs } from 'ember-cli-htmlbars';

export default {
  title: 'welcome-banner',
  component: 'WelcomeBanner',
  parameters: {
    docs: { story: { iframeHeight: '200px' }, },
  },
  argTypes: {
    backgroundColor: { control: 'color' },
    subTitleColor: { control: 'color' },
  },
};

export const Basic = (args) => ({
  template: hbs`
      {{welcome-banner
        backgroundColor=backgroundColor
        titleColor=titleColor
        subTitleColor=subTitleColor
        title=title
        subtitle=subtitle
      }}
    `,
  context: args,
});
Basic.args = {
  backgroundColor: '#FDF4E7',
  titleColor: '#DF4D37',
  subTitleColor: '#B8854F',
  title: 'Welcome to storybook',
  subtitle: 'This environment is completely editable',
};
