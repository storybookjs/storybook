import { type Documentation } from 'react-docgen';
import { type PropDescriptor } from 'react-docgen/dist/Documentation';

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
		if (tsType.name === 'union') {
			const parts = (tsType.elements ?? []).map(
				(el: any) => serializeTsType(el) ?? 'unknown',
			);
			return parts.join(' | ');
		}
		if (tsType.name === 'intersection') {
			const parts = (tsType.elements ?? []).map(
				(el: any) => serializeTsType(el) ?? 'unknown',
			);
			return parts.join(' & ');
		}
		if (tsType.name === 'Array') {
			// Prefer raw earlier; here build fallback
			const el = (tsType.elements ?? [])[0];
			const inner = serializeTsType(el) ?? 'unknown';
			return `${inner}[]`;
		}
		if (tsType.name === 'tuple') {
			const parts = (tsType.elements ?? []).map(
				(el: any) => serializeTsType(el) ?? 'unknown',
			);
			return `[${parts.join(', ')}]`;
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
				return `${p.key}${req ? '' : '?'}: ${propType}`;
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
