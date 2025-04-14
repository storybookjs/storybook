import { ComponentFixture, MetadataOverride, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Component, NgModule, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';
import { ICollection, StoryFnAngularReturnType } from '../../types';

export class TestBedComponentBuilder {
  private testBedInstance: TestBed;

  private component: Type<unknown> | undefined;

  private fixture: ComponentFixture<unknown>;

  private imports: any[] = [];

  private declarations: any[] = [];

  private componentProviders: any[] = [];

  private environmentProviders: any[] = [];

  private selector: string;

  private props: ICollection;

  private isUserDefinedTemplate = false;

  private userDefinedTemplate: string;

  private schemas: any[];

  private styles: string[];

  private id: string;

  setComponent(storyComponent: Type<unknown> | undefined) {
    this.component = storyComponent;
    return this;
  }

  setStoryFn(storyFn: StoryFnAngularReturnType) {
    this.styles = storyFn.styles;
    this.schemas = storyFn.moduleMetadata?.schemas;
    this.isUserDefinedTemplate = storyFn.userDefinedTemplate;
    this.userDefinedTemplate = storyFn.template;
    this.props = storyFn.props;
    return this;
  }

  setMetaData(metaData: PropertyExtractor) {
    const { imports, declarations, providers } = metaData;
    this.imports = imports;
    this.declarations = declarations;
    this.componentProviders = providers;
    return this;
  }

  setEnvironmentProviders(providers: any[]) {
    if (providers == null) return this;
    this.environmentProviders = providers ?? [];
    return this;
  }

  setSelector(selector: string) {
    this.selector = selector;
    return this;
  }

  setAndUpdateProps(props: ICollection) {
    this.props = props;
    this.updateComponentProps();
    return this;
  }

  configureModule() {
    this.throwOnRequiredNullProperties();
    if (this.isUserDefinedTemplate) {
      this.component = getWrapperComponent(
        this.selector,
        this.userDefinedTemplate,
        this.componentProviders,
        this.styles,
        this.schemas
      );
    }

    const metaData = this.generateOverrideMetaData();
    this.testBedInstance.configureTestingModule({}).overrideComponent(this.component, metaData);
    return this;
  }

  private generateOverrideMetaData() {
    const overrideData: MetadataOverride<Component> = { set: {} };
    if (this.schemas != null && this.schemas.length != 0) {
      overrideData.set.schemas = this.schemas;
    }
    if (this.componentProviders != null) {
      overrideData.set.providers = this.componentProviders;
    }
    if (this.styles != null) {
      overrideData.set.styles = this.styles;
    }
    if (this.selector != null) {
      overrideData.set.selector = this.selector;
    }

    const wrapperModule = getWrapperModule(
      this.declarations,
      this.imports,
      this.environmentProviders
    );
    overrideData.set.imports = [wrapperModule];

    return overrideData;
  }

  initTestBed() {
    this.testBedInstance = new TestBed();
    this.testBedInstance.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting()
    );
    return this;
  }

  async compileComponents() {
    await this.testBedInstance.compileComponents();
    this.fixture = this.testBedInstance.createComponent(this.component);
    this.updateComponentProps();
    this.id = this.fixture.nativeElement.id;
    return this;
  }

  getApplicationRef() {
    return this.testBedInstance.inject(ApplicationRef);
  }

  isInstanceFor(component: Type<unknown>) {
    return this.component == component;
  }

  private updateComponentProps() {
    if (this.props != null)
      this.fixture.componentInstance = Object.assign(this.fixture.componentInstance, this.props);
    this.fixture.detectChanges();
    return this;
  }

  private throwOnRequiredNullProperties() {
    if (this.component == null || this.testBedInstance == null) throw new Error('NullReference');
  }
}

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

export const getWrapperModule = (declarations: any[], imports: any[], moduleProviders: any[]) => {
  @NgModule({
    declarations,
    imports,
    providers: [...moduleProviders],
    exports: [...declarations, ...imports],
  })
  class WrapperModule {}
  return WrapperModule;
};
