import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';
import { ICollection, StoryFnAngularReturnType } from '../../types';
import { getWrapperModule } from '../StorybookWrapperComponent';
import {
  GenerateComponentMetaData,
  GenerateModuleMetaData,
  // eslint-disable-next-line import/namespace
} from './TestBedOverrideMetaDataGenerator';

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

  private schemas: any[];

  private styles: string[];

  constructor() {
    this.testBedInstance = new TestBed();
    this.testBedInstance.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting()
    );
  }

  setComponent(storyComponent: Type<unknown>) {
    this.component = storyComponent;
    return this;
  }

  setStoryFn(storyFn: StoryFnAngularReturnType) {
    this.styles = storyFn.styles;
    this.schemas = storyFn.moduleMetadata?.schemas;
    console.log(this.schemas);
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

  configure() {
    this.throwOnRequiredNullProperties();
    const wrapperModule = getWrapperModule();
    this.testBedInstance
      .configureTestingModule({})
      .overrideComponent(
        this.component,
        GenerateComponentMetaData(
          this.selector,
          this.componentProviders,
          this.styles,
          this.schemas,
          wrapperModule
        )
      )
      .overrideModule(
        wrapperModule,
        GenerateModuleMetaData(this.environmentProviders, this.declarations, this.imports)
      );

    return this;
  }

  async compileComponents() {
    await this.testBedInstance.compileComponents();
    this.fixture = this.testBedInstance.createComponent(this.component);
    this.updateComponentProps();
    return this;
  }

  getApplicationRef() {
    return this.testBedInstance.inject(ApplicationRef);
  }

  private updateComponentProps() {
    if (this.props != null)
      this.fixture.componentInstance = Object.assign(this.fixture.componentInstance, this.props);
    this.fixture.detectChanges();
    return this;
  }

  private throwOnRequiredNullProperties() {
    if (this.component == null || this.testBedInstance == null)
      throw new Error('Component attribute or testbed instance is null');
  }
}
