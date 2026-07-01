import { useState } from 'react';
import { Alert, Link } from 'reshaped';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export type AlertBannerProps = {
	message: string;
	variant?: AlertVariant;
	dismissible?: boolean;
	onClose?: () => void;
};

const variantToColor: Record<AlertVariant, 'primary' | 'positive' | 'warning' | 'critical'> = {
	info: 'primary',
	success: 'positive',
	warning: 'warning',
	error: 'critical',
};

export default function AlertBanner({
	message,
	variant = 'info',
	dismissible = false,
	onClose,
}: AlertBannerProps) {
	const [visible, setVisible] = useState(true);
	if (!visible) return null;

	const color = variantToColor[variant] ?? 'primary';

	const handleClose = () => {
		setVisible(false);
		onClose?.();
	};

	return (
		<Alert
			color={color}
			attributes={{
				'data-testid': 'alert-banner',
				role: 'status',
				'aria-live': 'polite',
			}}
			actionsSlot={
				dismissible ? (
					<Link
						variant="plain"
						color={color === 'primary' ? 'primary' : color}
						onClick={handleClose}
						attributes={{
							'data-testid': 'alert-close',
							'aria-label': 'Close alert',
						}}
					>
						Close
					</Link>
				) : undefined
			}
		>
			<span data-testid="alert-message">{message}</span>
		</Alert>
	);
}
