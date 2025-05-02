import { Component, NgModule } from '@angular/core';

export const getWrapperComponent = (template: string) => {
  @Component({
    template,
    standalone: true,
  })
  class CustomWrapperComponent {}
  return CustomWrapperComponent;
};

export const getWrapperModule = () => {
  @NgModule()
  class WrapperModule {}
  return WrapperModule;
};
