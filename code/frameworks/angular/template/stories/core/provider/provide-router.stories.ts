
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { RouterModule } from "@angular/router";
import { Component, importProvidersFrom } from "@angular/core";
import ProvideRouterComponent from "./router-component/router-component";

@Component({
  template: "",
})
class EmptyComponent {}

const meta: Meta<ProvideRouterComponent> = {
  component: ProvideRouterComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [RouterModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(
          RouterModule.forRoot([{ path: "**", component: EmptyComponent }], { useHash: true }),
        ),
      ],
    }),
  ],
};

export default meta;

type Story = StoryObj<ProvideRouterComponent>;

export const ProvideRouterWithoutArgs: Story = {};