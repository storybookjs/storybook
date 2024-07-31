// @vitest-environment happy-dom

import { NgModule, Component, EventEmitter, Input, Output } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ICollection } from '../types';
import { getApplication } from './StorybookModule';
import { storyPropsProvider } from './StorybookProvider';
import { PropertyExtractor } from './utils/PropertyExtractor';

describe('StorybookModule', () => {
  describe('getStorybookModuleMetadata', () => {
    describe('with simple component', () => {
      @Component({
        selector: 'foo',
        template: `
          <p id="input">{{ input }}</p>
          <p id="inputBindingPropertyName">{{ localPropertyName }}</p>
          <p id="setterCallNb">{{ setterCallNb }}</p>
          <p id="localProperty">{{ localProperty }}</p>
          <p id="localFunction">{{ localFunction() }}</p>
          <p id="output" (click)="output.emit('outputEmitted')"></p>
          <p id="outputBindingPropertyName" (click)="localOutput.emit('outputEmitted')"></p>
        `,
      })
      class FooComponent {
        @Input()
        public input: string;

        @Input('inputBindingPropertyName')
        public localPropertyName: string;

        @Input()
        public set setter(value: string) {
          this.setterCallNb += 1;
        }

        @Output()
        public output = new EventEmitter<string>();

        @Output('outputBindingPropertyName')
        public localOutput = new EventEmitter<string>();

        public localProperty: string;

        public localFunction = () => '';

        public setterCallNb = 0;
      }

      it('should initialize inputs', async () => {
        const props = {
          input: 'input',
          inputBindingPropertyName: 'inputBindingPropertyName',
          localProperty: 'localProperty',
          localFunction: () => 'localFunction',
        };

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: { props },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(new BehaviorSubject<ICollection>(props))],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(props.input);
        expect(fixture.nativeElement.querySelector('p#inputBindingPropertyName').innerHTML).toEqual(
          props.inputBindingPropertyName
        );
        expect(fixture.nativeElement.querySelector('p#localProperty').innerHTML).toEqual(
          props.localProperty
        );
        expect(fixture.nativeElement.querySelector('p#localFunction').innerHTML).toEqual(
          props.localFunction()
        );
      });

      it('should initialize outputs', async () => {
        let expectedOutputValue: string;
        let expectedOutputBindingValue: string;
        const props = {
          output: (value: string) => {
            expectedOutputValue = value;
          },
          outputBindingPropertyName: (value: string) => {
            expectedOutputBindingValue = value;
          },
        };

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: { props },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(new BehaviorSubject<ICollection>(props))],
        });
        fixture.detectChanges();

        fixture.nativeElement.querySelector('p#output').click();
        fixture.nativeElement.querySelector('p#outputBindingPropertyName').click();

        expect(expectedOutputValue).toEqual('outputEmitted');
        expect(expectedOutputBindingValue).toEqual('outputEmitted');
      });

      it('should change inputs if storyProps$ Subject emit', async () => {
        const initialProps = {
          input: 'input',
          inputBindingPropertyName: '',
        };
        const storyProps$ = new BehaviorSubject<ICollection>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: { props: initialProps },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });
        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(
          initialProps.input
        );
        expect(fixture.nativeElement.querySelector('p#inputBindingPropertyName').innerHTML).toEqual(
          ''
        );

        const newProps = {
          input: 'new input',
          inputBindingPropertyName: 'new inputBindingPropertyName',
          localProperty: 'new localProperty',
          localFunction: () => 'new localFunction',
        };
        storyProps$.next(newProps);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(newProps.input);
        expect(fixture.nativeElement.querySelector('p#inputBindingPropertyName').innerHTML).toEqual(
          newProps.inputBindingPropertyName
        );
        expect(fixture.nativeElement.querySelector('p#localProperty').innerHTML).toEqual(
          newProps.localProperty
        );
        expect(fixture.nativeElement.querySelector('p#localFunction').innerHTML).toEqual(
          newProps.localFunction()
        );
      });

      it('should override outputs if storyProps$ Subject emit', async () => {
        let expectedOutputValue;
        let expectedOutputBindingValue;
        const initialProps = {
          input: '',
          output: (value: string) => {
            expectedOutputValue = value;
          },
          outputBindingPropertyName: (value: string) => {
            expectedOutputBindingValue = value;
          },
        };
        const storyProps$ = new BehaviorSubject<ICollection>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: { props: initialProps },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });
        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();

        const newProps = {
          input: 'new input',
          output: () => {
            expectedOutputValue = 'should be called';
          },
          outputBindingPropertyName: () => {
            expectedOutputBindingValue = 'should be called';
          },
        };
        storyProps$.next(newProps);
        fixture.detectChanges();

        fixture.nativeElement.querySelector('p#output').click();
        fixture.nativeElement.querySelector('p#outputBindingPropertyName').click();

        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(newProps.input);
        expect(expectedOutputValue).toEqual('should be called');
        expect(expectedOutputBindingValue).toEqual('should be called');
      });

      it('should change template inputs if storyProps$ Subject emit', async () => {
        const initialProps = {
          color: 'red',
          input: 'input',
        };
        const storyProps$ = new BehaviorSubject<ICollection>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: {
            props: initialProps,
            template: '<p [style.color]="color"><foo [input]="input"></foo></p>',
          },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });
        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('p').style.color).toEqual('red');
        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(
          initialProps.input
        );

        const newProps = {
          color: 'black',
          input: 'new input',
        };
        storyProps$.next(newProps);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p').style.color).toEqual('black');
        expect(fixture.nativeElement.querySelector('p#input').innerHTML).toEqual(newProps.input);
      });

      it('should call the Input() setter the right number of times', async () => {
        const initialProps = {
          setter: 'init',
        };
        const storyProps$ = new BehaviorSubject<ICollection>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);

        const application = getApplication({
          storyFnAngular: { props: initialProps },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });
        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });

        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#setterCallNb').innerHTML).toEqual('1');

        const newProps = {
          setter: 'new setter value',
        };
        storyProps$.next(newProps);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#setterCallNb').innerHTML).toEqual('2');
      });
    });

    describe('with component without selector', () => {
      @Component({
        template: `The content`,
      })
      class WithoutSelectorComponent {}

      it('should display the component', async () => {
        const props = {};

        const analyzedMetadata = new PropertyExtractor(
          { entryComponents: [WithoutSelectorComponent] },
          WithoutSelectorComponent
        );

        const application = getApplication({
          storyFnAngular: {
            props,
            moduleMetadata: { entryComponents: [WithoutSelectorComponent] },
          },
          component: WithoutSelectorComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(new BehaviorSubject<ICollection>(props))],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.innerHTML).toContain('The content');
      });
    });

    it('should keep template with an empty value', async () => {
      @Component({
        selector: 'foo',
        template: `Should not be displayed`,
      })
      class FooComponent {}

      const analyzedMetadata = new PropertyExtractor({}, FooComponent);

      const application = getApplication({
        storyFnAngular: { template: '' },
        component: FooComponent,
        targetSelector: 'my-selector',
        analyzedMetadata,
      });

      const { fixture } = await configureTestingModule({
        imports: [application],
        providers: [storyPropsProvider(new BehaviorSubject<ICollection>({}))],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.innerHTML).toEqual('');
    });
  });

  async function configureTestingModule(ngModule: NgModule) {
    await TestBed.configureTestingModule(ngModule).compileComponents();

    const fixture = TestBed.createComponent(ngModule.imports[0] as any);

    return {
      fixture,
    };
  }
});
