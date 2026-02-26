import type { FC } from 'react';

interface ModalProps {
  title: string;
  open?: boolean;
}

// Component has an explicit displayName that differs from the variable name
const InternalModal: FC<ModalProps> = (_props) => null;
InternalModal.displayName = 'FancyModal';

export { InternalModal as Modal };
