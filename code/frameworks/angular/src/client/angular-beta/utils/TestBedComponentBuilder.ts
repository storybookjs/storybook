import { ComponentFixture, MetadataOverride, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import {
  ApplicationRef,
  Component,
  EnvironmentProviders,
  importProvidersFrom,
  Type,
} from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';
import { ICollection, StoryFnAngularReturnType } from '../../types';
import { BrowserModule } from '@angular/platform-browser';
import { getWrapperComponent, getWrapperModule } from '../StorybookWrapperComponent';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

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

  // some providers need to be removed, due already provided on module level of testbed
  private providersToRemove: EnvironmentProviders[] = [
    importProvidersFrom(BrowserDynamicTestingModule),
  ];

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
    console.log('EnvironmentProviders', this.environmentProviders);
    console.log('ProvidersToBeRemoved', this.providersToRemove);
    console.log('AfterFilter', this.environmentProviders);
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
    this.testBedInstance
      .configureTestingModule({
        providers: this.environmentProviders,
      })
      .overrideComponent(this.component, metaData);

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

    const wrapperModule = getWrapperModule(this.declarations, this.imports);
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
    return this;
  }

  getApplicationRef() {
    return this.testBedInstance.inject(ApplicationRef);
  }

  resetTestBed() {
    this.testBedInstance.resetTestingModule().resetTestEnvironment();
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
