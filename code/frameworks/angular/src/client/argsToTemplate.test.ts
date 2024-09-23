import { describe, expect, it } from 'vitest';

import { ArgsToTemplateOptions, argsToTemplate } from './argsToTemplate';

// adjust path

describe('argsToTemplate', () => {
  it('should correctly convert args to template string and exclude undefined values', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: undefined,
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {};
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'" [prop3]="'value3'"`);
  });

  it('should include properties from include option', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop3'],
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'" [prop3]="'value3'"`);
  });

  it('should include non-undefined properties from include option', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: undefined,
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop3'],
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'"`);
  });

  it('should exclude properties from exclude option', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      exclude: ['prop2'],
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'" [prop3]="'value3'"`);
  });

  it('should exclude properties from exclude option and undefined properties', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: undefined,
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      exclude: ['prop2'],
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'"`);
  });

  it('should prioritize include over exclude when both options are given', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop2'],
      exclude: ['prop2', 'prop3'],
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'" [prop2]="'value2'"`);
  });

  it('should work when neither include nor exclude options are given', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {};
    const result = argsToTemplate(args, options);
    expect(result).toBe(`[prop1]="'value1'" [prop2]="'value2'"`);
  });

  it('should bind events correctly when value is a function', () => {
    const args = { event1: () => {}, event2: () => {} };
    const result = argsToTemplate(args, {});
    expect(result).toEqual('(event1)="event1($event)" (event2)="event2($event)"');
  });

  it('should mix properties and events correctly', () => {
    const args = { input: 'Value1', event1: () => {} };
    const result = argsToTemplate(args, {});
    expect(result).toEqual(`[input]="'Value1'" (event1)="event1($event)"`);
  });

  it('should format for non dot notation', () => {
    const args = { 'non-dot': 'Value1', 'dash-out': () => {} };
    const result = argsToTemplate(args, {});
    expect(result).toEqual(`[non-dot]="'Value1'" (dash-out)="this[\'dash-out\']($event)"`);
  });

  it('should correctly convert args to variable bindings and exclude undefined values', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: undefined,
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = { bindVariableNames: true };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1" [prop3]="prop3"');
  });

  it('should include variable bindings from include option', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop3'],
      bindVariableNames: true,
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1" [prop3]="prop3"');
  });

  it('should exclude non-undefined variable bindings from include option', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: undefined,
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop3'],
      bindVariableNames: true,
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1"');
  });

  it('should exclude variable bindings from exclude option', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      exclude: ['prop2'],
      bindVariableNames: true,
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1" [prop3]="prop3"');
  });

  it('should exclude variable binding from exclude option and undefined properties', () => {
    const args: Record<string, any> = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: undefined,
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      exclude: ['prop2'],
      bindVariableNames: true,
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1"');
  });

  it('should prioritize include over exclude when both options are given and show variable bindings', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
      prop3: 'value3',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = {
      include: ['prop1', 'prop2'],
      exclude: ['prop2', 'prop3'],
      bindVariableNames: true,
    };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1" [prop2]="prop2"');
  });

  it('should work when neither include nor exclude options are given and show variable bindings', () => {
    const args = {
      prop1: 'value1',
      prop2: 'value2',
    };
    const options: ArgsToTemplateOptions<keyof typeof args> = { bindVariableNames: true };
    const result = argsToTemplate(args, options);
    expect(result).toBe('[prop1]="prop1" [prop2]="prop2"');
  });

  it('should bind events correctly when variable binding', () => {
    const args = { event1: () => {}, event2: () => {} };
    const result = argsToTemplate(args, { bindVariableNames: true });
    expect(result).toEqual('(event1)="event1($event)" (event2)="event2($event)"');
  });

  it('should mix properties and events correctly when variable binding', () => {
    const args = { input: 'Value1', event1: () => {} };
    const result = argsToTemplate(args, { bindVariableNames: true });
    expect(result).toEqual('[input]="input" (event1)="event1($event)"');
  });

  it('should format for non dot notation when variable binding', () => {
    const args = { 'non-dot': 'Value1', 'dash-out': () => {} };
    const result = argsToTemplate(args, { bindVariableNames: true });
    expect(result).toEqual('[non-dot]="this[\'non-dot\']" (dash-out)="this[\'dash-out\']($event)"');
  });

  it('should display event binding after property binding', () => {
    const args = { event: () => {}, input: 'Value1' };
    const results = argsToTemplate(args);
    expect(results).toEqual(`[input]="'Value1'" (event)="event($event)"`);
  });

  it('should keep args key order by default', () => {
    const args = { zInput: 'ValueZ', event: () => {}, input: 'Value1' };
    const results = argsToTemplate(args);
    expect(results).toEqual(`[zInput]="'ValueZ'" [input]="'Value1'" (event)="event($event)"`);
  });

  it('should keep args key order by default', () => {
    const args = { zEvent: () => {}, zInput: 'ValueZ', event: () => {}, input: 'Value1' };
    const results = argsToTemplate(args);
    expect(results).toEqual(
      `[zInput]="'ValueZ'" [input]="'Value1'" (zEvent)="zEvent($event)" (event)="event($event)"`
    );
  });

  it('should sort args keys when sort set to true', () => {
    const args = { zEvent: () => {}, zInput: 'ValueZ', event: () => {}, input: 'Value1' };
    const results = argsToTemplate(args, { sort: true });
    expect(results).toEqual(
      `[input]="'Value1'" [zInput]="'ValueZ'" (event)="event($event)" (zEvent)="zEvent($event)"`
    );
  });
});
