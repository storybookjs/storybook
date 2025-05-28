import { describe, expect, it, vi } from 'vitest';
import dedent from 'dedent';

import { generateCodeToEmit } from './emit-code.js';

describe('Emit Code', () => {
  it('should replace short spread args with single-line props', () => {
    expect(
      generateCodeToEmit({
        code: '<MyComponent {...args} />',
        args: { someBool: true, someString: 'this is a string' },
      })
    ).toMatchInlineSnapshot(`"<MyComponent someBool someString="this is a string" />"`);
  });

  it('should replace long spread args with multi-line props', () => {
    expect(
      generateCodeToEmit({
        code: '<MyComponent {...args} />',
        args: {
          someBool: true,
          someString: 'this is a string',
          someNumber: 42,
          someObject: { nested: 'yes', multiple: 'also yes' },
        },
      })
    ).toMatchInlineSnapshot(`
      "<MyComponent 
        someBool
        someString="this is a string"
        someNumber={42}
        someObject={{ "nested": "yes", "multiple": "also yes" }}
       />"
    `);
  });

  it('should replace all types of values', () => {
    expect(
      generateCodeToEmit({
        code: '<MyComponent {...args} />',
        args: {
          someTrue: true,
          someFalse: false,
          someNull: null,
          someUndefined: undefined,
          someString: 'this is a string',
          someNumber: 42,
          someObject: { nested: 'yes', deep: { nestedDeep: true } },
          someArray: [11, 'some string', { someObj: { nested: 'yes' } }],
        },
      })
    ).toMatchInlineSnapshot(`
      "<MyComponent 
        someTrue
        someFalse={false}
        someString="this is a string"
        someNumber={42}
        someObject={{ "nested": "yes", "deep": {  "nestedDeep": true } }}
        someArray={[ 11, "some string", {  "someObj": {   "nested": "yes"  } } ]}
       />"
    `);
  });

  it('should replace args in nested components', () => {
    expect(
      generateCodeToEmit({
        code: dedent`
        <Top topProp={args.single}>
          <Child {...args}>
            <GrandChild nestedProp={args.other} />
          </Child>
        </Top>`,
        args: {
          single: 'some string',
          aNumber: 42,
          other: { someBool: true, nested: 'yes' },
        },
      })
    ).toMatchInlineSnapshot(`
      "<Top topProp={"some string"}>
        <Child 
        single="some string"
        aNumber={42}
        other={{ "someBool": true, "nested": "yes" }}
      >
          <GrandChild nestedProp={{ "someBool": true, "nested": "yes" }} />
        </Child>
      </Top>"
    `);
  });

  it('should replace individually referenced args', () => {
    expect(
      generateCodeToEmit({
        code: dedent`<MyComponent
        firstProp={args.someString}
        num={args.someNumber}
        nestedBool={args.someObject.someBool}
        nestedOptional={args.someObject?.nested}
        optionalNotExist={args.doesNotExist?.someKey}
        ternaryProp={args.someObject.someBool ? args.yes : args.no}
      >
        {args}
        {args.text}
        {args?.optional?.text}
        {args.someObject["someStringKey"]}
        {args.someObject['someStringKey']}
        {args.someObject['someStringKey'].nested}
        {args.someArray[1]}
        {args.someUnnamedFn}
        {args.someNamedFn}
        {args.someUnnamedMockFn}
        {args.someNamedMockFn}
        {someFunction(args.yes)}
        {someFunction(!args.someObject.someBool ? "literal yes" : args.no)}
        args.shouldNotBeReplacedButIs
      </MyComponent>`,
        args: {
          someIgnoredArg: 'should not show up anywhere',
          someString: 'this is a string',
          someNumber: 42,
          someObject: {
            someBool: true,
            nested: 'yes',
            deep: { shouldAlsoBeIgnored: true },
            someStringKey: { nested: 'deep' },
          },
          someArray: ['first', 'second'],
          someUnnamedFn: () => {},
          someNamedFn: function namedFunc() {},
          someUnnamedMockFn: vi.fn(),
          someNamedMockFn: vi.fn().mockName('namedMockFn'),
          yes: 'yup',
          no: 'nope',
          text: 'some text',
          optional: { text: 'optional text' },
        },
      })
    ).toMatchInlineSnapshot(
      `
      "<MyComponent
        firstProp={"this is a string"}
        num={42}
        nestedBool={true}
        nestedOptional={"yes"}
        optionalNotExist={undefined}
        ternaryProp={true ? "yup" : "nope"}
      >
        {args}
        {"some text"}
        {"optional text"}
        {{ "nested": "deep" }}
        {{ "nested": "deep" }}
        {"deep"}
        {"second"}
        {someUnnamedFn}
        {namedFunc}
        {() => {}}
        {namedMockFn}
        {someFunction("yup")}
        {someFunction(!true ? "literal yes" : "nope")}
        undefined
      </MyComponent>"
    `
    );
  });
});
