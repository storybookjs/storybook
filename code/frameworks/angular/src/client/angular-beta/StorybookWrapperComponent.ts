import { Component, NgModule } from '@angular/core';

export const getWrapperComponent = (
  selector: string,
  template: string,
  providers: any[],
  styles: string[],
  schemas: any[]
) => {
  @Component({
    selector,
    template,
    standalone: true,
    providers,
    styles,
    schemas: schemas,
  })
  class CustomWrapperComponent {}
  return CustomWrapperComponent;
};

export const getWrapperModule = (declarations: any[], imports: any[]) => {
  @NgModule({
    declarations: declarations,
    imports: imports,
    exports: [...declarations, ...imports],
  })
  class WrapperModule {}
  return WrapperModule;
};
