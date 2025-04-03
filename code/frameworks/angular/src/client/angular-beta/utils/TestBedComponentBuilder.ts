import { ComponentFixture, getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ApplicationRef, Type } from '@angular/core';
import { PropertyExtractor } from './PropertyExtractor';

export class TestBedComponentBuilder {
  private testBedInstance: TestBed;

  private component: Type<unknown> | undefined = undefined;

  private imports: any[];

  private declarations: any[];

  private providers: any[];

  private selector: string;

  constructor() {
    this.testBedInstance = new TestBed();
    this.testBedInstance.initTestEnvironment(
      BrowserDynamicTestingModule,
      platformBrowserDynamicTesting()
    );
  }

  setComponent(storyComponent: Type<unknown> | undefined) {
    this.component = storyComponent;
    return this;
  }

  setMetaData(analyzedMetadata: PropertyExtractor) {
    const { imports, declarations, providers } = analyzedMetadata;
    this.imports = imports;
    this.declarations = declarations;
    this.providers = providers;
    return this;
  }

  setSelector(selector: string) {
    this.selector = selector;
    return this;
  }

  configureModule() {
    this.throwOnRequiredNullProperties();
    this.testBedInstance
      .configureTestingModule({
        imports: this.imports,
        declarations: this.declarations,
        providers: this.providers,
      })
      .overrideComponent(this.component, {
        set: {
          providers: this.providers,
          selector: this.selector,
        },
      });
    return this;
  }

  async compileComponents() {
    await this.testBedInstance.compileComponents();
    return this.testBedInstance.createComponent(this.component);
  }

  getApplicationRef() {
    return this.testBedInstance.inject(ApplicationRef);
  }

  private throwOnRequiredNullProperties() {
    if (this.component == null || this.testBedInstance == null)
      throw new Error("NullReference")
  }
}
