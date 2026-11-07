// @vitest-environment happy-dom

import type { NgModule, Type } from '@angular/core';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import type { ICollection } from '../types.ts';
import { getApplication } from './StorybookModule.ts';
import { storyPropsProvider } from './StorybookProvider.ts';
import { PropertyExtractor } from './utils/PropertyExtractor.ts';

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
        public input?: string;

        @Input('inputBindingPropertyName')
        public localPropertyName?: string;

        @Input()
        public set setter(value: string) {
          this.setterCallNb += 1;
        }

        @Output()
        public output = new EventEmitter<string>();

        @Output('outputBindingPropertyName')
        public localOutput = new EventEmitter<string>();

        public localProperty?: string;

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
        await analyzedMetadata.init();

        const application = getApplication({
          storyFnAngular: { props },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(new BehaviorSubject<ICollection | undefined>(props))],
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
        let expectedOutputValue: string | undefined;
        let expectedOutputBindingValue: string | undefined;
        const props = {
          output: (value: string) => {
            expectedOutputValue = value;
          },
          outputBindingPropertyName: (value: string) => {
            expectedOutputBindingValue = value;
          },
        };

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);
        await analyzedMetadata.init();

        const application = getApplication({
          storyFnAngular: { props },
          component: FooComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(new BehaviorSubject<ICollection | undefined>(props))],
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
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);
        await analyzedMetadata.init();

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
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);
        await analyzedMetadata.init();

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
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);
        await analyzedMetadata.init();

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
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, FooComponent);
        await analyzedMetadata.init();

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

    describe('with signal properties', () => {
      @Component({
        selector: 'signal-property',
        template: `
          <p id="optionCount">{{ options().length }}</p>
          <p id="label">{{ label }}</p>
        `,
      })
      class SignalPropertyComponent {
        // A framework-owned signal: story props must never overwrite it with a
        // plain value. contentChildren() queries are signals too, but signal
        // queries do not resolve under this vitest setup (no Angular compiler
        // transform), so the regression is pinned with a plain signal — the
        // wrapper code path being tested is the same.
        public options = signal(['preserved']).asReadonly();

        public label = '';
      }

      it('should preserve signals while updating ordinary props', async () => {
        const initialProps = {
          options: [],
          label: 'initial label',
        };
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, SignalPropertyComponent);
        await analyzedMetadata.init();

        const application = getApplication({
          storyFnAngular: {
            props: initialProps,
            template: '<signal-property></signal-property>',
          },
          component: SignalPropertyComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#optionCount').innerHTML).toEqual('1');
        expect(fixture.nativeElement.querySelector('p#label').innerHTML).toEqual('initial label');

        storyProps$.next({ options: [], label: 'updated label' });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#optionCount').innerHTML).toEqual('1');
        expect(fixture.nativeElement.querySelector('p#label').innerHTML).toEqual('updated label');
      });

      it('should apply a signal story prop that replaces a signal field', async () => {
        const initialProps = {
          options: signal(['one', 'two', 'three']),
          label: 'initial label',
        };
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, SignalPropertyComponent);
        await analyzedMetadata.init();

        const application = getApplication({
          storyFnAngular: {
            props: initialProps,
            template: '<signal-property></signal-property>',
          },
          component: SignalPropertyComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#optionCount').innerHTML).toEqual('3');
        expect(fixture.nativeElement.querySelector('p#label').innerHTML).toEqual('initial label');

        storyProps$.next({ options: signal(['one']), label: 'updated label' });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#optionCount').innerHTML).toEqual('1');
        expect(fixture.nativeElement.querySelector('p#label').innerHTML).toEqual('updated label');
      });
    });

    describe('with getter/setter properties', () => {
      @Component({
        selector: 'getter-setter',
        template: ` <p id="labelLength">{{ labelLength }}</p> `,
      })
      class GetterSetterComponent {
        // The getter reads state that only the setter initializes, so
        // evaluating it before the setter runs throws. Applying story props
        // must never read the property value — only its stored descriptor —
        // and the template reads the state through a separate getter that
        // tolerates the uninitialized state.
        private _label: string | undefined;

        public get label(): string {
          return this._label!.toUpperCase();
        }

        public set label(value: string) {
          this._label = value;
        }

        public get labelLength(): number {
          return this._label?.length ?? 0;
        }
      }

      it('should apply the story prop without evaluating the getter first', async () => {
        const initialProps = {
          label: 'hello',
        };
        const storyProps$ = new BehaviorSubject<ICollection | undefined>(initialProps);

        const analyzedMetadata = new PropertyExtractor({}, GetterSetterComponent);
        await analyzedMetadata.init();

        const application = getApplication({
          storyFnAngular: {
            props: initialProps,
            template: '<getter-setter></getter-setter>',
          },
          component: GetterSetterComponent,
          targetSelector: 'my-selector',
          analyzedMetadata,
        });

        const { fixture } = await configureTestingModule({
          imports: [application],
          providers: [storyPropsProvider(storyProps$)],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#labelLength').innerHTML).toEqual('5');

        storyProps$.next({ label: 'world!' });
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('p#labelLength').innerHTML).toEqual('6');
      });
    });

    describe('with component without selector', () => {
      @Component({
        template: ` The content `,
      })
      class WithoutSelectorComponent {}

      it('should display the component', async () => {
        const props = {};

        const analyzedMetadata = new PropertyExtractor(
          { entryComponents: [WithoutSelectorComponent] },
          WithoutSelectorComponent
        );

        await analyzedMetadata.init();

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
          providers: [storyPropsProvider(new BehaviorSubject<ICollection | undefined>(props))],
        });
        fixture.detectChanges();

        expect(fixture.nativeElement.innerHTML).toContain('The content');
      });
    });

    it('should keep template with an empty value', async () => {
      @Component({
        selector: 'foo',
        template: ` Should not be displayed `,
      })
      class FooComponent {}

      const analyzedMetadata = new PropertyExtractor({}, FooComponent);
      await analyzedMetadata.init();

      const application = getApplication({
        storyFnAngular: { template: '' },
        component: FooComponent,
        targetSelector: 'my-selector',
        analyzedMetadata,
      });

      const { fixture } = await configureTestingModule({
        imports: [application],
        providers: [storyPropsProvider(new BehaviorSubject<ICollection | undefined>({}))],
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.innerHTML).toEqual('');
    });
  });

  async function configureTestingModule(ngModule: NgModule & { imports: [Type<unknown>] }) {
    await TestBed.configureTestingModule(ngModule).compileComponents();

    const fixture = TestBed.createComponent(ngModule.imports[0]);

    return {
      fixture,
    };
  }
});
