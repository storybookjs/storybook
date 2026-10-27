// @vitest-environment happy-dom

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Component,
  EventEmitter,
  Injectable,
  Input,
  Output,
  VERSION,
  inject,
  ɵresetJitOptions,
} from '@angular/core';

import type { DecoratorFunction, StoryContextForRender } from 'storybook/internal/types';

import { decorateStory } from '../decorateStory.ts';
import { componentWrapperDecorator } from '../decorators.ts';
import type { AngularRenderer } from '../types.ts';
import { RendererFactory } from './RendererFactory.ts';
import type { TestBedRenderer } from './TestBedRenderer.ts';
import { resetTestBed } from './utils/TestBedMounting.ts';

declare const document: Document;

@Injectable()
class ApiService {
  data = 'original Api Service';
}

@Component({
  selector: 'provider-button',
  template: '{{ label }}',
  providers: [ApiService],
})
class ProviderButtonComponent {
  label = inject(ApiService).data;
}

describe('TestBedRenderer', () => {
  let rendererFactory: RendererFactory;
  let rootTargetDOMNode: HTMLElement;

  // Runs the story through the preview's decorator chain, which generates the component template
  // before the renderer sees the story.
  const renderStory = async (
    story: Parameters<TestBedRenderer['render']>[0]['storyFnAngular'],
    component?: unknown,
    forced = false,
    decorators: DecoratorFunction<AngularRenderer>[] = []
  ) => {
    const renderer = await rendererFactory.getRendererInstance(rootTargetDOMNode, true);
    const storyFnAngular = decorateStory(
      () => story,
      decorators
    )({ component } as StoryContextForRender<AngularRenderer>);
    await renderer.render({
      storyFnAngular,
      forced,
      component,
      targetDOMNode: rootTargetDOMNode,
      storyId: 'my-story',
    });
  };

  const storyRoot = () => document.body.getElementsByTagName('my-story')[0];

  beforeEach(() => {
    rendererFactory = new RendererFactory();
    document.body.innerHTML = '<div id="storybook-root"></div><div id="storybook-docs"></div>';
    const root = document.getElementById('storybook-root');
    assert(root);
    rootTargetDOMNode = root;
    // @ts-expect-error Ignore
    globalThis.STORYBOOK_ANGULAR_OPTIONS = { zoneless: false };
  });

  afterEach(() => {
    resetTestBed();
    ɵresetJitOptions();
  });

  it('mounts a component story as the fixture root, without a wrapper component', async () => {
    @Component({ selector: 'foo', template: '🦊' })
    class FooComponent {}

    await renderStory({ props: {} }, FooComponent);

    expect(storyRoot().innerHTML).toBe(`<foo ng-version="${VERSION.full}">🦊</foo>`);
  });

  it('keeps the wrapper component when a decorator wraps the generated template', async () => {
    @Component({ selector: 'foo', template: '🦊' })
    class FooComponent {}

    await renderStory({ props: {} }, FooComponent, false, [
      componentWrapperDecorator((story) => `<div class="wrap">${story}</div>`),
    ]);

    expect(storyRoot().getAttribute('ng-version')).toBe(VERSION.full);
    expect(storyRoot().querySelector('.wrap > foo')?.textContent).toBe('🦊');
  });

  it('hosts a component without a selector on an ng-component element', async () => {
    @Component({ template: '🦊' })
    class FooComponent {}

    await renderStory({ props: {} }, FooComponent);

    expect(storyRoot().innerHTML).toBe(
      `<ng-component ng-version="${VERSION.full}">🦊</ng-component>`
    );
  });

  it('binds the props that are inputs and outputs', async () => {
    @Component({
      selector: 'foo',
      template: '<button (click)="clicked.emit(label)">{{ label }}</button>',
    })
    class FooComponent {
      @Input() label = '';
      @Output() clicked = new EventEmitter<string>();
    }
    const clicked = vi.fn();

    await renderStory({ props: { label: 'Hello', clicked } }, FooComponent);
    storyRoot().querySelector('button')!.click();

    expect(storyRoot().textContent).toBe('Hello');
    expect(clicked).toHaveBeenCalledWith('Hello');
  });

  it('assigns a prop that is not an input to the instance before it initializes', async () => {
    let nameOnInit: string | undefined;

    @Component({ selector: 'foo', template: '{{ name }}' })
    class FooComponent {
      name = 'default';

      ngOnInit() {
        nameOnInit = this.name;
      }
    }

    await renderStory({ props: { name: 'from the story' } }, FooComponent);

    expect(storyRoot().textContent).toBe('from the story');
    expect(nameOnInit).toBe('from the story');
  });

  it('updates the instance in place when only the props change', async () => {
    let instances = 0;

    @Component({ selector: 'foo', template: '{{ label }} {{ name }}' })
    class FooComponent {
      @Input() label = '';
      name = '';

      constructor() {
        instances += 1;
      }
    }

    await renderStory({ props: { label: 'Hello', name: 'Fox' } }, FooComponent, true);
    await renderStory({ props: { label: 'Bye', name: 'Wolf' } }, FooComponent, true);

    expect(storyRoot().textContent).toBe('Bye Wolf');
    expect(instances).toBe(1);
  });

  it('lets moduleMetadata.providers override a provider the component declares for itself', async () => {
    await renderStory(
      {
        props: {},
        moduleMetadata: {
          providers: [{ provide: ApiService, useValue: { data: 'Mock Service' } }],
        },
      },
      ProviderButtonComponent
    );

    expect(storyRoot().textContent).toBe('Mock Service');
  });

  it('keeps the component provider when the story does not provide the token', async () => {
    await renderStory({ props: {} }, ProviderButtonComponent);

    expect(storyRoot().textContent).toBe('original Api Service');
  });

  it('shares one story provider between the component and its template siblings', async () => {
    let created = 0;

    class MockApiService {
      data = 'Mock Service';

      constructor() {
        created += 1;
      }
    }

    @Component({ selector: 'sibling', template: '{{ label }}' })
    class SiblingComponent {
      label = inject(ApiService).data;
    }

    await renderStory(
      {
        props: {},
        template: '<provider-button></provider-button> <sibling></sibling>',
        moduleMetadata: {
          imports: [SiblingComponent],
          providers: [{ provide: ApiService, useClass: MockApiService }],
        },
      },
      ProviderButtonComponent
    );

    expect(storyRoot().textContent).toBe('Mock ServiceMock Service');
    expect(created).toBe(1);
  });

  it('renders a user template through the wrapper when the component is not a component', async () => {
    @Injectable()
    class DocService {}

    await renderStory(
      {
        props: {},
        template: '<provider-button></provider-button>',
        moduleMetadata: { imports: [ProviderButtonComponent] },
      },
      DocService
    );

    expect(storyRoot().getAttribute('ng-version')).toBe(VERSION.full);
    expect(storyRoot().textContent).toBe('original Api Service');
  });

  it('keeps the wrapper component for a story with styles', async () => {
    @Component({ selector: 'foo', template: '🦊' })
    class FooComponent {}

    await renderStory({ props: {}, styles: ['foo { color: red }'] }, FooComponent);

    expect(
      storyRoot()
        .getAttributeNames()
        .some((name) => name.startsWith('_nghost'))
    ).toBe(true);
    expect(storyRoot().textContent).toBe('🦊');
  });
});
