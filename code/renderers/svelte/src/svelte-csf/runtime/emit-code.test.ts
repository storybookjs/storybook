import { describe, expect, it } from 'vitest';
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
          someObject: { nested: 'yes', mutliple: 'also yes' },
        },
      })
    ).toMatchInlineSnapshot(`
      "<MyComponent 
        someBool
        someString="this is a string"
        someNumber={42}
        someObject={{ "nested": "yes", "mutliple": "also yes" }}
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
      "<Top topProp="some string">
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
        code: '<MyComponent firstProp={args.someString} somethingStatic={42} nestedBoolRef={args.someObject.someBool} nestedStringRef={args.someObject.nested} />',
        args: {
          someIgnoredArg: 'should not show up',
          someString: 'this is a string',
          someObject: { someBool: true, nested: 'yes', deep: { shouldAlsoBeIgnored: true } },
        },
      })
    ).toMatchInlineSnapshot(
      `"<MyComponent firstProp="this is a string" somethingStatic={42} nestedBoolRef nestedStringRef="yes" />"`
    );
  });
});
