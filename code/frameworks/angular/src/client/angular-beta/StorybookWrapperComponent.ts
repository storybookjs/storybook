import type { AfterViewInit, ElementRef, OnDestroy, Type } from '@angular/core';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  isSignal,
  NgModule,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import type { Subject, Subscription } from 'rxjs';
import { map, skip } from 'rxjs/operators';
import { once } from 'storybook/internal/client-logger';

import type { ICollection, NgModuleMetadata } from '../types.ts';
import { STORY_PROPS } from './StorybookProvider.ts';
import type { ComponentInputsOutputs } from './utils/NgComponentAnalyzer.ts';
import { getComponentInputsOutputs } from './utils/NgComponentAnalyzer.ts';
import { PropertyExtractor } from './utils/PropertyExtractor.ts';

// A story prop is only skipped when it would replace a signal field with a
// plain value (the crash from #32201). A signal story prop may replace a
// signal field, and reading the own data property never evaluates a getter:
// signal fields are class fields, so they are own data properties, while
// prototype getters are not.
const isPreservedSignal = (instance: object, key: string, value: unknown) =>
  isSignal(Object.getOwnPropertyDescriptor(instance, key)?.value) && !isSignal(value);

const getNonInputsOutputsProps = (
  ngComponentInputsOutputs: ComponentInputsOutputs,
  props: ICollection = {},
  componentInstance: object
) => {
  const inputs = ngComponentInputsOutputs.inputs
    .filter((i) => i.templateName in props)
    .map((i) => i.templateName);
  const outputs = ngComponentInputsOutputs.outputs
    .filter((o) => o.templateName in props)
    .map((o) => o.templateName);
  return Object.keys(props).filter((k) => {
    if ([...inputs, ...outputs].includes(k)) {
      return false;
    }
    if (isPreservedSignal(componentInstance, k, props[k])) {
      once.warn(
        `Storybook: skipping story prop "${k}" because it would overwrite a signal on the component. Pass a signal value to replace the signal.`
      );
      return false;
    }
    return true;
  });
};

/** Wraps the story template into a component */
export const createStorybookWrapperComponent = ({
  selector,
  template,
  storyComponent,
  styles,
  moduleMetadata,
  initialProps = {},
  analyzedMetadata,
}: {
  selector: string;
  template: string | undefined;
  storyComponent: Type<unknown> | undefined;
  styles: string[] | undefined;
  moduleMetadata: NgModuleMetadata;
  initialProps?: ICollection;
  analyzedMetadata: PropertyExtractor;
}): Type<any> => {
  // In ivy, a '' selector is not allowed, therefore we need to just set it to anything if
  // storyComponent was not provided.
  const viewChildSelector = storyComponent ?? '__storybook-noop';

  const { imports, declarations, providers } = analyzedMetadata;

  @NgModule({
    declarations,
    imports,
    exports: [...declarations, ...imports],
  })
  class StorybookComponentModule {}

  PropertyExtractor.warnImportsModuleWithProviders(analyzedMetadata);

  @Component({
    selector,
    template,
    standalone: true,
    imports: [StorybookComponentModule],
    providers,
    styles,
    schemas: moduleMetadata.schemas,
  })
  class StorybookWrapperComponent implements AfterViewInit, OnDestroy {
    private storyComponentPropsSubscription: Subscription | undefined;

    private storyWrapperPropsSubscription: Subscription | undefined;

    @ViewChild(viewChildSelector, { static: true }) storyComponentElementRef:
      | ElementRef
      | undefined;

    @ViewChild(viewChildSelector, { read: ViewContainerRef, static: true })
    storyComponentViewContainerRef: ViewContainerRef | undefined;

    // Used in case of a component without selector
    storyComponent = storyComponent ?? '';

    constructor(
      @Inject(STORY_PROPS) private storyProps$: Subject<ICollection | undefined>,
      @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
      // Subscribes to the observable storyProps$ to keep these properties up to date
      this.storyWrapperPropsSubscription = this.storyProps$.subscribe((storyProps = {}) => {
        // All props are added as component properties
        Object.assign(this, storyProps);

        this.changeDetectorRef.detectChanges();
        this.changeDetectorRef.markForCheck();
      });
    }

    ngAfterViewInit(): void {
      // Bind properties to component, if the story have component
      const { storyComponentElementRef, storyComponentViewContainerRef } = this;
      if (storyComponentElementRef && storyComponentViewContainerRef) {
        const ngComponentInputsOutputs = getComponentInputsOutputs(storyComponent);

        const initialOtherProps = getNonInputsOutputsProps(
          ngComponentInputsOutputs,
          initialProps,
          storyComponentElementRef
        );

        // Initializes properties that are not Inputs | Outputs
        // Allows story props to override local component properties
        initialOtherProps.forEach((p) => {
          Object.assign(storyComponentElementRef, { [p]: initialProps[p] });
        });
        // `markForCheck` the component in case this uses changeDetection: OnPush
        // And then forces the `detectChanges`
        storyComponentViewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
        this.changeDetectorRef.detectChanges();

        // Once target component has been initialized, the storyProps$ observable keeps target component properties than are not Input|Output up to date
        this.storyComponentPropsSubscription = this.storyProps$
          .pipe(
            skip(1),
            map((props = {}) => {
              const propsKeyToKeep = getNonInputsOutputsProps(
                ngComponentInputsOutputs,
                props,
                storyComponentElementRef
              );
              return propsKeyToKeep.reduce((acc, p) => ({ ...acc, [p]: props[p] }), {});
            })
          )
          .subscribe((props) => {
            // Replace inputs with new ones from props
            Object.assign(storyComponentElementRef, props);

            // `markForCheck` the component in case this uses changeDetection: OnPush
            // And then forces the `detectChanges`
            storyComponentViewContainerRef.injector.get(ChangeDetectorRef).markForCheck();
            this.changeDetectorRef.detectChanges();
          });
      }
    }

    ngOnDestroy(): void {
      if (this.storyComponentPropsSubscription != null) {
        this.storyComponentPropsSubscription.unsubscribe();
      }
      if (this.storyWrapperPropsSubscription != null) {
        this.storyWrapperPropsSubscription.unsubscribe();
      }
    }
  }
  return StorybookWrapperComponent;
};
