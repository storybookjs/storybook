import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Component, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';
import { ICollection, StoryFnAngularReturnType } from '../../types';

export class TestBedComponentBuilder {
  private testBedInstance: TestBed;

  private component: Type<unknown> | undefined;

  private fixture: ComponentFixture<unknown>;

  private imports: any[] = [];

  private declarations: any[] = [];

  private componentProviders: any[] = [];

  private environmentProvider: any[] = [];

  private selector: string;

  private props: ICollection;

  private isUserDefinedTemplate = false;

  private userDefinedTemplate: string;

  private schemas: any[] = [];

  private styles: string[] = [];

  private id: string;

  setComponent(storyComponent: Type<unknown> | undefined) {
    this.component = storyComponent;
    return this;
  }

  setStoryFn(storyFn: StoryFnAngularReturnType) {
    this.styles = storyFn.styles ?? [];
    this.schemas = storyFn.moduleMetadata?.schemas ?? [];
    this.isUserDefinedTemplate = storyFn.userDefinedTemplate;
    this.userDefinedTemplate = storyFn.template;
    this.props = storyFn.props;
    return this;
  }

  setMetaData(metaData: PropertyExtractor) {
    const { imports, declarations, providers } = metaData;
    this.imports = imports ?? [];
    this.declarations = declarations ?? [];
    this.componentProviders = providers ?? [];
    return this;
  }

  setEnvironmentProviders(providers: any[]) {
    if (providers == null) return this;
    this.environmentProvider = providers ?? [];
    return this;
  }

  setSelector(selector: string) {
    this.selector = selector;
    return this;
  }

  setAndUpdateProps(props: ICollection) {
    this.props = props ?? [];
    this.updateComponentProps();
    return this;
  }

  configureModule() {
    this.throwOnRequiredNullProperties();
    if (this.isUserDefinedTemplate) {
      this.component = getWrapper(this.selector, this.userDefinedTemplate);
    }

    this.testBedInstance
      .configureTestingModule({
        providers: this.environmentProvider,
        declarations: this.declarations,
        imports: this.imports,
      })
      .overrideComponent(this.component, {
        set: {
          providers: this.componentProviders,
          selector: this.selector,
          schemas: this.schemas,
          styles: this.styles,
        },
      });
    return this;
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
    this.fixture.componentInstance = Object.assign(this.fixture.componentInstance, this.props);
    this.fixture.detectChanges();
    return this;
  }

  private throwOnRequiredNullProperties() {
    if (this.component == null || this.testBedInstance == null) throw new Error('NullReference');
  }
}

export const getWrapper = (selector: string, template: string) => {
  @Component({
    selector,
    template,
    standalone: true,
  })
  class CustomWrapperComponent {}
  return CustomWrapperComponent;
};
