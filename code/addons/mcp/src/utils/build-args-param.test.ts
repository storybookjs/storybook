import { describe, expect, it } from 'vitest';
import { buildArgsParam } from './build-args-param.ts';

describe('buildArgsParam', () => {
	it('returns empty string for empty object', () => {
		expect(buildArgsParam({})).toEqual('');
	});

	it('returns empty string for null/undefined', () => {
		expect(buildArgsParam(null as any)).toEqual('');
		expect(buildArgsParam(undefined as any)).toEqual('');
	});

	it('builds a simple key-value pair', () => {
		const param = buildArgsParam({ key: 'val' });
		expect(param).toEqual('key:val');
	});

	it('builds multiple values', () => {
		const param = buildArgsParam({ one: '1', two: '2', three: '3' });
		expect(param).toEqual('one:1;two:2;three:3');
	});

	it('builds booleans', () => {
		const param = buildArgsParam({ yes: true, no: false });
		expect(param).toEqual('yes:!true;no:!false');
	});

	it('builds numbers', () => {
		const param = buildArgsParam({ count: 42, decimal: 3.14 });
		expect(param).toEqual('count:42;decimal:3.14');
	});

	it('builds arrays', () => {
		const param = buildArgsParam({ arr: ['1', '2', '3'] });
		expect(param).toEqual('arr[0]:1;arr[1]:2;arr[2]:3');
	});

	it('builds sparse arrays', () => {
		// eslint-disable-next-line no-sparse-arrays
		const param = buildArgsParam({ arr: ['1', , '3'] });
		expect(param).toEqual('arr[0]:1;arr[2]:3');
	});

	it('builds simple objects', () => {
		const param = buildArgsParam({ obj: { one: '1', two: '2' } });
		expect(param).toEqual('obj.one:1;obj.two:2');
	});

	it('builds nested objects', () => {
		const param = buildArgsParam({
			obj: { foo: { one: '1', two: '2' }, bar: { one: '1' } },
		});
		expect(param).toEqual('obj.foo.one:1;obj.foo.two:2;obj.bar.one:1');
	});

	it('builds arrays in objects', () => {
		// eslint-disable-next-line no-sparse-arrays
		const param = buildArgsParam({ obj: { foo: ['1', , '3'] } });
		expect(param).toEqual('obj.foo[0]:1;obj.foo[2]:3');
	});

	it('builds single object in array', () => {
		const param = buildArgsParam({ arr: [{ one: '1', two: '2' }] });
		expect(param).toEqual('arr[0].one:1;arr[0].two:2');
	});

	it('builds multiple objects in array', () => {
		const param = buildArgsParam({ arr: [{ one: '1' }, { two: '2' }] });
		expect(param).toEqual('arr[0].one:1;arr[1].two:2');
	});

	it('builds nested object in array', () => {
		const param = buildArgsParam({ arr: [{ foo: { bar: 'val' } }] });
		expect(param).toEqual('arr[0].foo.bar:val');
	});

	it('encodes space as +', () => {
		const param = buildArgsParam({ key: 'foo bar baz' });
		expect(param).toEqual('key:foo+bar+baz');
	});

	it('encodes null values as !null', () => {
		const param = buildArgsParam({ key: null });
		expect(param).toEqual('key:!null');
	});

	it('encodes undefined values as !undefined', () => {
		const param = buildArgsParam({ key: undefined });
		expect(param).toEqual('key:!undefined');
	});

	it('encodes nested null values as !null', () => {
		const param = buildArgsParam({
			foo: { bar: [{ key: null }], baz: null },
		});
		expect(param).toEqual('foo.bar[0].key:!null;foo.baz:!null');
	});

	it('encodes hex color values as !hex(value)', () => {
		const param = buildArgsParam({ key: '#ff4785' });
		expect(param).toEqual('key:!hex(ff4785)');
	});

	it('encodes short hex color values', () => {
		const param = buildArgsParam({ key: '#f47' });
		expect(param).toEqual('key:!hex(f47)');
	});

	it('encodes 8-digit hex color values with alpha', () => {
		const param = buildArgsParam({ key: '#ff478580' });
		expect(param).toEqual('key:!hex(ff478580)');
	});

	it('encodes rgba color values by prefixing and compacting', () => {
		const param = buildArgsParam({
			rgb: 'rgb(255, 71, 133)',
			rgba: 'rgba(255, 71, 133, 0.5)',
		});
		expect(param).toEqual('rgb:!rgb(255,71,133);rgba:!rgba(255,71,133,0.5)');
	});

	it('encodes hsla color values by prefixing and compacting', () => {
		const param = buildArgsParam({
			hsl: 'hsl(45, 99%, 70%)',
			hsla: 'hsla(45, 99%, 70%, 0.5)',
		});
		expect(param).toEqual('hsl:!hsl(45,99,70);hsla:!hsla(45,99,70,0.5)');
	});

	it('encodes Date objects as !date(ISO string)', () => {
		const param = buildArgsParam({
			key: new Date('2001-02-03T04:05:06.789Z'),
		});
		expect(param).toEqual('key:!date(2001-02-03T04:05:06.789Z)');
	});

	it('handles mixed types', () => {
		const param = buildArgsParam({
			str: 'hello',
			num: 42,
			bool: true,
			nil: null,
			arr: [1, 2],
			obj: { nested: 'value' },
		});
		expect(param).toEqual(
			'str:hello;num:42;bool:!true;nil:!null;arr[0]:1;arr[1]:2;obj.nested:value',
		);
	});
});
