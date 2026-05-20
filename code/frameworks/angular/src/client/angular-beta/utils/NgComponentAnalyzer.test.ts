// @vitest-environment happy-dom

import type { Type } from '@angular/core';
import {
  Component,
  // Removed in Angular 22
  // ComponentFactoryResolver,
  Directive,
  EventEmitter,
  HostBinding,
  Injectable,
  Input,
  Output,
  Pipe,
  input,
  output,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule } from '@angular/platform-browser-dynamic/testing';
import { describe, expect, it } from 'vitest';

import {
  getComponentInputsOutputs,
  isComponent,
  isDeclarable,
  getComponentDecoratorMetadata,
  isStandaloneComponent,
} from './NgComponentAnalyzer.ts';

describe('getComponentInputsOutputs', () => {
  it('should return empty if no I/O found', () => {
    @Component({
      standalone: false,
    })
    class FooComponent {}

    expect(getComponentInputsOutputs(FooComponent)).toEqual({
      inputs: [],
      outputs: [],
    });

    class BarComponent {}

    expect(getComponentInputsOutputs(BarComponent)).toEqual({
      inputs: [],
      outputs: [],
    });
  });

/* Commented out until we figure out how to handle the removal of ComponentFactoryResolver in Angular 22
  See https://github.com/angular/angular/releases/tag/v22.0.0-next.7

  it('should return I/O', () => {
    @Component({
      template: '',
      inputs: ['inputInComponentMetadata'],
      outputs: ['outputInComponentMetadata'],
      standalone: false,
    })
    class FooComponent {
      @Input()
      public input: string;

      public signalInput = input<string>();

      public signalInputAliased = input<string>('signalInputAliased', {
        alias: 'signalInputAliasedAlias',
      });

      @Input('inputPropertyName')
      public inputWithBindingPropertyName: string;

      @Output()
      public output = new EventEmitter<Event>();

      @Output('outputPropertyName')
      public outputWithBindingPropertyName = new EventEmitter<Event>();

      public signalOutput = output<string>();
    }

    const fooComponentFactory = resolveComponentFactory(FooComponent);

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect({ inputs, outputs }).toEqual({
      inputs: [
        { propName: 'inputInComponentMetadata', templateName: 'inputInComponentMetadata' },
        { propName: 'input', templateName: 'input' },
        { propName: 'inputWithBindingPropertyName', templateName: 'inputPropertyName' },
      ],
      outputs: [
        { propName: 'outputInComponentMetadata', templateName: 'outputInComponentMetadata' },
        { propName: 'output', templateName: 'output' },
        { propName: 'outputWithBindingPropertyName', templateName: 'outputPropertyName' },
      ],
    });

    expect(sortByPropName(inputs)).toEqual(
      sortByPropName(fooComponentFactory.inputs.map(({ isSignal, ...rest }) => rest))
    );
    expect(sortByPropName(outputs)).toEqual(sortByPropName(fooComponentFactory.outputs));
  });

  it("should return I/O when some of component metadata has the same name as one of component's properties", () => {
    @Component({
      template: '',
      inputs: ['input', 'inputWithBindingPropertyName'],
      outputs: ['outputWithBindingPropertyName'],
      standalone: false,
    })
    class FooComponent {
      @Input()
      public input: string;

      @Input('inputPropertyName')
      public inputWithBindingPropertyName: string;

      @Output()
      public output = new EventEmitter<Event>();

      @Output('outputPropertyName')
      public outputWithBindingPropertyName = new EventEmitter<Event>();
    }

    const fooComponentFactory = resolveComponentFactory(FooComponent);

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect(sortByPropName(inputs)).toEqual(
      sortByPropName(fooComponentFactory.inputs.map(({ isSignal, ...rest }) => rest))
    );
    expect(sortByPropName(outputs)).toEqual(sortByPropName(fooComponentFactory.outputs));
  });

  it('should return I/O in the presence of multiple decorators', () => {
    @Component({
      template: '',
      standalone: false,
    })
    class FooComponent {
      @Input()
      @HostBinding('class.preceeding-first')
      public inputPreceedingHostBinding: string;

      @HostBinding('class.following-binding')
      @Input()
      public inputFollowingHostBinding: string;
    }

    const fooComponentFactory = resolveComponentFactory(FooComponent);

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect({ inputs, outputs }).toEqual({
      inputs: [
        { propName: 'inputPreceedingHostBinding', templateName: 'inputPreceedingHostBinding' },
        { propName: 'inputFollowingHostBinding', templateName: 'inputFollowingHostBinding' },
      ],
      outputs: [],
    });

    expect(sortByPropName(inputs)).toEqual(
      sortByPropName(fooComponentFactory.inputs.map(({ isSignal, ...rest }) => rest))
    );
    expect(sortByPropName(outputs)).toEqual(sortByPropName(fooComponentFactory.outputs));
  });

  it('should return I/O with extending classes', () => {
    @Component({
      template: '',
      standalone: false,
    })
    class BarComponent {
      @Input()
      public a: string;

      @Input()
      public b: string;
    }

    @Component({
      template: '',
      standalone: false,
    })
    class FooComponent extends BarComponent {
      @Input()
      declare public b: string;

      @Input()
      public c: string;
    }

    const fooComponentFactory = resolveComponentFactory(FooComponent);

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect({ inputs, outputs }).toEqual({
      inputs: [
        { propName: 'a', templateName: 'a' },
        { propName: 'b', templateName: 'b' },
        { propName: 'c', templateName: 'c' },
      ],
      outputs: [],
    });

    expect(sortByPropName(inputs)).toEqual(
      sortByPropName(fooComponentFactory.inputs.map(({ isSignal, ...rest }) => rest))
    );
    expect(sortByPropName(outputs)).toEqual(sortByPropName(fooComponentFactory.outputs));
  });
  */
});

describe('getComponentInputsOutputs (signal-based I/O)', () => {
  // The unit harness leaves `ɵcmp` empty for signal members, so we attach a
  // synthetic `ɵcmp` in the AOT shape and assert the production reader. Real
  // end-to-end signal detection is covered by the `model-signal` sandbox stories.
  //   inputs:  { [templateName]: [propName, flags] }
  //   outputs: { [templateName]: propName }
  const withCmp = (inputs: Record<string, unknown>, outputs: Record<string, string>) => {
    class FooComponent {}
    (FooComponent as any).ɵcmp = { inputs, outputs };
    return FooComponent;
  };

  it('detects @Input / @Output (decorator path, unchanged)', () => {
    @Component({ template: '', standalone: false })
    class FooComponent {
      @Input() public input: string;

      @Input('inputPropertyName') public inputWithBindingPropertyName: string;

      @Output() public output = new EventEmitter<Event>();

      @Output('outputPropertyName') public outputWithBindingPropertyName =
        new EventEmitter<Event>();
    }

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect(sortByPropName(inputs)).toEqual(
      sortByPropName([
        { propName: 'input', templateName: 'input' },
        { propName: 'inputWithBindingPropertyName', templateName: 'inputPropertyName' },
      ])
    );
    expect(sortByPropName(outputs)).toEqual(
      sortByPropName([
        { propName: 'output', templateName: 'output' },
        { propName: 'outputWithBindingPropertyName', templateName: 'outputPropertyName' },
      ])
    );
  });

  it('detects EventEmitter @Output (decorator path, unchanged)', () => {
    @Component({ template: '', standalone: true })
    class FooComponent {
      @Output() public emitter = new EventEmitter<string>();
    }

    const { outputs } = getComponentInputsOutputs(FooComponent);

    expect(outputs).toContainEqual({ propName: 'emitter', templateName: 'emitter' });
  });

  it('detects input() / output() signal members from ɵcmp', () => {
    const FooComponent = withCmp(
      { signalInput: ['signalInput', 1] },
      { signalOutput: 'signalOutput' }
    );

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect(inputs).toContainEqual({ propName: 'signalInput', templateName: 'signalInput' });
    expect(outputs).toContainEqual({ propName: 'signalOutput', templateName: 'signalOutput' });
  });

  it('detects model() as an input plus its synthesized `${name}Change` output', () => {
    // `color = model()`, `reqd = model.required()`, `aliased = model(_, { alias: 'al' })`.
    // The Angular compiler resolves the alias in `ɵcmp`, so the input is keyed by the
    // binding name (`al`) and the synthesized output by `${alias}Change` (`alChange`).
    const FooComponent = withCmp(
      { color: ['color', 1], reqd: ['reqd', 1], al: ['aliased', 1] },
      { colorChange: 'color', reqdChange: 'reqd', alChange: 'aliased' }
    );

    const { inputs, outputs } = getComponentInputsOutputs(FooComponent);

    expect(inputs).toContainEqual({ propName: 'color', templateName: 'color' });
    expect(outputs).toContainEqual({ propName: 'color', templateName: 'colorChange' });

    expect(inputs).toContainEqual({ propName: 'reqd', templateName: 'reqd' });
    expect(outputs).toContainEqual({ propName: 'reqd', templateName: 'reqdChange' });

    // Aliased model(): the resolved binding name (`al`/`alChange`) flows through.
    expect(inputs).toContainEqual({ propName: 'aliased', templateName: 'al' });
    expect(outputs).toContainEqual({ propName: 'aliased', templateName: 'alChange' });
  });
});

describe('isDeclarable', () => {
  it('should return true with a Component', () => {
    @Component({})
    class FooComponent {}

    expect(isDeclarable(FooComponent)).toEqual(true);
  });

  it('should return true with a Directive', () => {
    @Directive({})
    class FooDirective {}

    expect(isDeclarable(FooDirective)).toEqual(true);
  });

  it('should return true with a Pipe', () => {
    @Pipe({ name: 'pipe' })
    class FooPipe {}

    expect(isDeclarable(FooPipe)).toEqual(true);
  });

  it('should return false with simple class', () => {
    class FooPipe {}

    expect(isDeclarable(FooPipe)).toEqual(false);
  });
  it('should return false with Injectable', () => {
    @Injectable()
    class FooInjectable {}

    expect(isDeclarable(FooInjectable)).toEqual(false);
  });
});

describe('isComponent', () => {
  it('should return true with a Component', () => {
    @Component({})
    class FooComponent {}

    expect(isComponent(FooComponent)).toEqual(true);
  });

  it('should return false with simple class', () => {
    class FooPipe {}

    expect(isComponent(FooPipe)).toEqual(false);
  });
  it('should return false with Directive', () => {
    @Directive()
    class FooDirective {}

    expect(isComponent(FooDirective)).toEqual(false);
  });
});

describe('isStandaloneComponent', () => {
  it('should return true with a Component with "standalone: true"', () => {
    @Component({ standalone: true })
    class FooComponent {}

    expect(isStandaloneComponent(FooComponent)).toEqual(true);
  });

  it('should return false with a Component with "standalone: false"', () => {
    @Component({ standalone: false })
    class FooComponent {}

    expect(isStandaloneComponent(FooComponent)).toEqual(false);
  });

  it('should return false with a Component without the "standalone" property', () => {
    @Component({})
    class FooComponent {}

    expect(isStandaloneComponent(FooComponent)).toEqual(false);
  });

  it('should return false with simple class', () => {
    class FooPipe {}

    expect(isStandaloneComponent(FooPipe)).toEqual(false);
  });

  it('should return true with a Directive with "standalone: true"', () => {
    @Directive({ standalone: true })
    class FooDirective {}

    expect(isStandaloneComponent(FooDirective)).toEqual(true);
  });

  it('should return false with a Directive with "standalone: false"', () => {
    @Directive({ standalone: false })
    class FooDirective {}

    expect(isStandaloneComponent(FooDirective)).toEqual(false);
  });

  it('should return false with Directive without the "standalone" property', () => {
    @Directive()
    class FooDirective {}

    expect(isStandaloneComponent(FooDirective)).toEqual(false);
  });

  it('should return true with a Pipe with "standalone: true"', () => {
    @Pipe({ name: 'FooPipe', standalone: true })
    class FooPipe {}

    expect(isStandaloneComponent(FooPipe)).toEqual(true);
  });

  it('should return false with a Pipe with "standalone: false"', () => {
    @Pipe({ name: 'FooPipe', standalone: false })
    class FooPipe {}

    expect(isStandaloneComponent(FooPipe)).toEqual(false);
  });

  it('should return false with Pipe without the "standalone" property', () => {
    @Pipe({
      name: 'fooPipe',
    })
    class FooPipe {}

    expect(isStandaloneComponent(FooPipe)).toEqual(false);
  });
});

describe('getComponentDecoratorMetadata', () => {
  it('should return Component with a Component', () => {
    @Component({ selector: 'foo' })
    class FooComponent {}

    expect(getComponentDecoratorMetadata(FooComponent)).toBeInstanceOf(Component);
    expect(getComponentDecoratorMetadata(FooComponent)).toEqual({
      changeDetection: 1,
      selector: 'foo',
    });
  });

  it('should return Component with extending classes', () => {
    @Component({ selector: 'bar' })
    class BarComponent {}
    @Component({ selector: 'foo' })
    class FooComponent extends BarComponent {}

    expect(getComponentDecoratorMetadata(FooComponent)).toBeInstanceOf(Component);
    expect(getComponentDecoratorMetadata(FooComponent)).toEqual({
      changeDetection: 1,
      selector: 'foo',
    });
  });
});

function sortByPropName(
  array: {
    propName: string;
    templateName: string;
  }[]
) {
  return array.sort((a, b) => a.propName.localeCompare(b.propName));
}
/*
function resolveComponentFactory<T extends Type<any>>(component: T) {
  TestBed.configureTestingModule({
    declarations: [component],
  }).overrideModule(BrowserDynamicTestingModule, {});
  const componentFactoryResolver = TestBed.inject(ComponentFactoryResolver);

  return componentFactoryResolver.resolveComponentFactory(component);
}
*/
