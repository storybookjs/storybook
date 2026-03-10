export interface SharedProps {
  /** Unique identifier */
  id: string;
  /** Optional CSS class name */
  className?: string;
}

export type Variant = 'primary' | 'secondary' | 'danger';

export interface ClickableProps {
  /** Click handler */
  onClick?: (event: { target: string }) => void;
  disabled?: boolean;
}
