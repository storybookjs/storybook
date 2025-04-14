/* eslint-disable @typescript-eslint/naming-convention */
export {};

declare global {
  var Components: any;
  var __STORYBOOK_ADDONS_CHANNEL__: {
    emit: any;
    on: any;
  };
  var storybookRenderer: string;
}
