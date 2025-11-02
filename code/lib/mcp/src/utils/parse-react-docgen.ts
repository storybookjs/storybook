import type { PropDescriptor, Documentation } from 'react-docgen';

export type ParsedDocgen = {
	props: Record<
		string,
		{
			description?: string;
			type?: string;
			defaultValue?: string;
			required?: boolean;
		}
	>;
};

// Serialize a react-docgen tsType into a TypeScript-like string when raw is not available
function serializeTsType(tsType: PropDescriptor['tsType']): string | undefined {
	if (!tsType) return undefined;
	// Prefer raw if provided
	if (
		'raw' in tsType &&
		typeof tsType.raw === 'string' &&
		tsType.raw.trim().length > 0
	) {
		return tsType.raw;
	}

	if (!tsType.name) return undefined;

	if ('elements' in tsType) {
		const serializeElements = () =>
			(tsType.elements ?? []).map(
				(el: any) => serializeTsType(el) ?? 'unknown',
			);

		switch (tsType.name) {
			case 'union':
				return serializeElements().join(' | ');
			case 'intersection':
				return serializeElements().join(' & ');
			case 'Array': {
				const inner = serializeTsType((tsType.elements ?? [])[0]) ?? 'unknown';
				return `${inner}[]`;
			}
			case 'tuple':
				return `[${serializeElements().join(', ')}]`;
		}
	}
	if ('value' in tsType && tsType.name === 'literal') {
		return tsType.value;
	}
	if ('signature' in tsType && tsType.name === 'signature') {
		if (tsType.type === 'function') {
			const args = (tsType.signature?.arguments ?? []).map((a: any) => {
				const argType = serializeTsType(a.type) ?? 'any';
				return `${a.name}: ${argType}`;
			});
			const ret = serializeTsType(tsType.signature?.return) ?? 'void';
			return `(${args.join(', ')}) => ${ret}`;
		}
		if (tsType.type === 'object') {
			const props = (tsType.signature?.properties ?? []).map((p) => {
				const req: boolean = Boolean(p.value?.required);
				const propType = serializeTsType(p.value) ?? 'any';
				return `${p.key as string}${req ? '' : '?'}: ${propType}`;
			});
			return `{ ${props.join('; ')} }`;
		}
		return 'unknown';
	}
	// Default case (Generic like Item<TMeta>)
	if ('elements' in tsType) {
		const inner = (tsType.elements ?? []).map(
			(el) => serializeTsType(el) ?? 'unknown',
		);
		if (inner.length > 0) return `${tsType.name}<${inner.join(', ')}>`;
	}

	return tsType.name;
}

export const parseReactDocgen = (reactDocgen: Documentation): ParsedDocgen => {
	const props: Record<string, any> = (reactDocgen as any)?.props ?? {};
	return {
		props: Object.fromEntries(
			Object.entries(props).map(([propName, prop]) => [
				propName,
				{
					description: prop.description,
					type: serializeTsType(prop.tsType ?? prop.type),
					defaultValue: prop.defaultValue?.value,
					required: prop.required,
				},
			]),
		),
	};
};
