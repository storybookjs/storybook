export {};

declare global {
  var __TEMPLATE_COMPONENTS__: any;
  var __STORYBOOK_ADDONS_CHANNEL__: {
    emit: any;
    on: any;
  };
  var storybookRenderer: string;
}
