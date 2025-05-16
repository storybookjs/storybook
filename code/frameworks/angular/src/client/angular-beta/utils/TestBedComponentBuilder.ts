import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, ComponentFactoryResolver, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';
import { ICollection, StoryFnAngularReturnType } from '../../types';
import { getWrapperModule } from '../TestBedWrapperComponent';
import {
  GenerateComponentMetaData,
  GenerateModuleMetaData,
} from './TestBedOverrideMetaDataGenerator';

export class TestBedComponentBuilder {
  private testBedInstance: TestBed;

  private component: Type<unknown> | undefined;

  private componentInputs: string[] = [];

  private fixture: ComponentFixture<unknown>;

  private imports: any[] = [];

  private declarations: any[] = [];

  private componentProviders: any[] = [];

  private environmentProviders: any[] = [];

  private selector: string;

  private props: ICollection;

  private schemas: any[];

  private styles: string[];

  private targetNode: HTMLElement | null = null;

  constructor() {
    this.testBedInstance = new TestBed();
    this.testBedInstance.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting()
    );
  }

  getFixture() {
    return this.fixture;
  }

  setComponent(storyComponent: Type<unknown>) {
    this.component = storyComponent;
    return this;
  }

  setTargetNode(targetNode: HTMLElement) {
    this.targetNode = targetNode;
    return this;
  }

  setStoryFn(storyFn: StoryFnAngularReturnType) {
    this.styles = storyFn.styles;
    this.schemas = storyFn.moduleMetadata?.schemas;
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

  configure() {
    this.throwOnMissingTestBedInstance();
    this.throwOnMissingComponent();
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

  copyComponentIntoTargetNode() {
    this.throwOnMissingFixture();
    this.throwOnMissingTargetNode();
    this.targetNode.appendChild(this.fixture.nativeElement);
    this.fixture.autoDetectChanges(true);
  }

  private calculateComponentInputs() {
    if (this.props == null) return;
    const componentResolver = this.testBedInstance.inject(ComponentFactoryResolver);
    this.componentInputs = componentResolver
      .resolveComponentFactory(this.component)
      .inputs.map((input) => input.propName);
  }

  private updateComponentProps() {
    this.throwOnMissingFixture();
    this.calculateComponentInputs();
    if (this.props != null) {
      this.fixture.componentInstance = Object.assign(this.fixture.componentInstance, this.props);
      for (const key in this.props) {
        if (!this.componentInputs.includes(key)) continue;
        // had to be done to trigger angular's lifecycle hook like ngOnchange
        this.fixture.componentRef.setInput(key, this.props[key]);
      }
    }
    this.fixture.detectChanges();
    return this;
  }

  private throwOnMissingComponent() {
    if (this.component == null) throw new Error('Component attribute is null');
  }

  private throwOnMissingTestBedInstance() {
    if (this.testBedInstance == null) throw new Error('Testbed instance is null');
  }

  private throwOnMissingFixture() {
    if (this.fixture == null) throw new Error('Fixture is null');
  }

  private throwOnMissingTargetNode() {
    if (this.targetNode == null) throw new Error('TargetNode is null');
  }
}
