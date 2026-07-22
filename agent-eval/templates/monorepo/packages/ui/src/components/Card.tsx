import type { ReactNode } from 'react';

export type CardProps = {
	title: string;
	children: ReactNode;
	padded?: boolean;
};

export default function Card({ title, children, padded = true }: CardProps) {
	return (
		<section
			data-testid="card"
			style={{
				border: '1px solid #e5e7eb',
				borderRadius: 8,
				boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
				padding: padded ? 16 : 0,
			}}
		>
			<h2 style={{ fontSize: 16, margin: '0 0 8px' }}>{title}</h2>
			{children}
		</section>
	);
}
